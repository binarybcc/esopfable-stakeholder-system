# Case Management Database Schema

## Core Entities

### 1. Users & Authentication
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('legal_team', 'government_entity', 'esop_participant', 'witness', 'media_contact', 'opposition')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP
);
```

### 2. Stakeholder Management
```sql
CREATE TABLE stakeholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    title VARCHAR(255),
    contact_info JSONB, -- Encrypted storage
    metadata JSONB, -- Category-specific fields
    security_level VARCHAR(20) DEFAULT 'standard' CHECK (security_level IN ('standard', 'restricted', 'high')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Legal Team specific fields in metadata:
-- {"specialty": "erisa", "firm": "ABC Law", "fee_structure": "hourly", "engagement_status": "active"}

-- Government Entities specific fields:
-- {"jurisdiction": "federal", "damage_estimate": 50000000, "cooperation_level": "high", "legal_counsel": "DOJ"}

-- ESOP Participants specific fields:
-- {"years_service": 15, "esop_stake": 2.5, "sentiment": "supportive", "leadership_role": false}

-- Key Witnesses specific fields:
-- {"evidence_access": "high", "vulnerability_level": 8, "protection_needed": true, "testimony_strength": "strong"}

-- Media Contacts specific fields:
-- {"outlet": "Wall Street Journal", "beat": "investigative", "relationship_quality": "good", "reach": "national"}

-- Opposition specific fields:
-- {"influence_level": "high", "likely_response": "aggressive", "mitigation_strategy": "legal pressure"}
```

### 3. Document Management
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_path VARCHAR(1000), -- Encrypted file storage path
    file_hash VARCHAR(128), -- For integrity verification
    file_size BIGINT,
    mime_type VARCHAR(100),
    classification VARCHAR(50) CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
    uploaded_by UUID REFERENCES users(id),
    version_number INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id), -- For version history
    encryption_key_id UUID, -- Reference to encryption key
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- 'view', 'download', 'edit', 'delete'
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Evidence Chain & Custody
```sql
CREATE TABLE evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id),
    evidence_type VARCHAR(100) NOT NULL,
    source_stakeholder_id UUID REFERENCES stakeholders(id),
    chain_of_custody JSONB, -- Array of custody transfers
    integrity_hash VARCHAR(128),
    authenticity_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    significance_level INTEGER CHECK (significance_level BETWEEN 1 AND 10),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chain of custody format:
-- [{"from_user": "uuid", "to_user": "uuid", "transferred_at": "timestamp", "reason": "discovery", "location": "office"}]
```

### 5. Communication Tracking
```sql
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_type VARCHAR(50) NOT NULL, -- 'email', 'call', 'meeting', 'letter'
    subject VARCHAR(500),
    summary TEXT,
    participants JSONB, -- Array of stakeholder IDs
    initiated_by UUID REFERENCES stakeholders(id),
    occurred_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER,
    location VARCHAR(255),
    outcome VARCHAR(100),
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    sensitive_content BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communication_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID REFERENCES communications(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    attachment_type VARCHAR(50)
);
```

### 6. Tasks & Timeline Management
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    task_type VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    due_date DATE,
    completed_at TIMESTAMP,
    depends_on JSONB, -- Array of task IDs this task depends on
    stakeholder_ids JSONB, -- Related stakeholders
    phase VARCHAR(100), -- Case phase this task belongs to
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    update_type VARCHAR(50), -- 'status_change', 'comment', 'assignment'
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 7. Risk Monitoring
```sql
CREATE TABLE risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL, -- 'retaliation', 'evidence_destruction', 'witness_intimidation'
    severity_level INTEGER CHECK (severity_level BETWEEN 1 AND 10),
    description TEXT NOT NULL,
    affected_stakeholders JSONB, -- Array of stakeholder IDs
    reported_by UUID REFERENCES users(id),
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    mitigation_actions JSONB, -- Array of action descriptions
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'closed')),
    occurred_at TIMESTAMP,
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stakeholder_id UUID REFERENCES stakeholders(id),
    risk_category VARCHAR(100),
    risk_level INTEGER CHECK (risk_level BETWEEN 1 AND 10),
    assessment_notes TEXT,
    protective_measures JSONB,
    assessed_by UUID REFERENCES users(id),
    assessment_date DATE DEFAULT CURRENT_DATE,
    next_review_date DATE
);
```

### 8. PR Message Management
```sql
CREATE TABLE pr_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_type VARCHAR(100), -- 'press_release', 'statement', 'talking_points'
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    target_audience JSONB, -- Array of audience types
    approval_status VARCHAR(50) DEFAULT 'draft' CHECK (approval_status IN ('draft', 'review', 'approved', 'published', 'archived')),
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    published_at TIMESTAMP,
    version_number INTEGER DEFAULT 1,
    parent_message_id UUID REFERENCES pr_messages(id),
    stakeholder_coordination JSONB, -- Which stakeholders need to be informed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 9. Audit & System Logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB,
    source VARCHAR(100), -- 'auth', 'database', 'file_system', etc.
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Indexes for Performance
```sql
-- User lookups
CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_type ON users(role_type);

-- Stakeholder searches
CREATE INDEX idx_stakeholders_category ON stakeholders(category);
CREATE INDEX idx_stakeholders_security_level ON stakeholders(security_level);
CREATE INDEX idx_stakeholders_user_id ON stakeholders(user_id);

-- Document access
CREATE INDEX idx_documents_classification ON documents(classification);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_document_access_log_user_id ON document_access_log(user_id);
CREATE INDEX idx_document_access_log_document_id ON document_access_log(document_id);

-- Communication tracking
CREATE INDEX idx_communications_occurred_at ON communications(occurred_at);
CREATE INDEX idx_communications_type ON communications(communication_type);

-- Task management
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Risk monitoring
CREATE INDEX idx_risk_events_severity ON risk_events(severity_level);
CREATE INDEX idx_risk_events_status ON risk_events(status);

-- Audit logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

## Security Considerations

1. **Encryption**: All sensitive data in `contact_info` and file paths encrypted at rest
2. **Access Control**: Role-based permissions with field-level restrictions
3. **Audit Trails**: Comprehensive logging of all system access and modifications
4. **Data Isolation**: External portal users only see filtered, approved data
5. **Backup Strategy**: Automated encrypted backups with point-in-time recovery