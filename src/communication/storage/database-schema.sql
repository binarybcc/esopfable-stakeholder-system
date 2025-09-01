-- Communication Tracking System Database Schema
-- Designed for PostgreSQL with security and legal requirements in mind

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- for performance monitoring

-- Cases table (reference to main case management system)
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number VARCHAR(100) NOT NULL UNIQUE,
  case_name VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stakeholders/Participants table
CREATE TABLE IF NOT EXISTS stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(100), -- Reference to main stakeholder system
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  organization VARCHAR(255),
  role VARCHAR(100) NOT NULL, -- client, attorney, witness, expert, etc.
  relationship VARCHAR(100) NOT NULL, -- attorney_client, work_product, etc.
  status VARCHAR(50) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Communication channels configuration
CREATE TABLE IF NOT EXISTS communication_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL, -- email, call, meeting, etc.
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  security_config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Main communications table
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id),
  channel_id UUID REFERENCES communication_channels(id),
  type VARCHAR(50) NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  
  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Content
  subject VARCHAR(1000),
  content_text TEXT,
  content_html TEXT,
  content_format VARCHAR(50) DEFAULT 'text',
  content_language VARCHAR(10) DEFAULT 'en',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  thread_id VARCHAR(255), -- For email threads, call chains, etc.
  reply_to_id UUID REFERENCES communications(id),
  forwarded_from_id UUID REFERENCES communications(id),
  
  -- Status and priority
  status VARCHAR(50) DEFAULT 'active',
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Legal and security
  privilege_status VARCHAR(50) DEFAULT 'pending' CHECK (privilege_status IN ('privileged', 'work_product', 'public', 'confidential', 'pending')),
  classification_sensitivity VARCHAR(20) DEFAULT 'medium' CHECK (classification_sensitivity IN ('low', 'medium', 'high', 'critical')),
  classification_category VARCHAR(100),
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES stakeholders(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Technical
  raw_data JSONB, -- Original data from the channel
  content_hash VARCHAR(64), -- SHA-256 hash of content
  encryption_status VARCHAR(50) DEFAULT 'encrypted',
  
  -- Full text search
  search_vector tsvector
);

-- Communication participants (many-to-many relationship)
CREATE TABLE IF NOT EXISTS communication_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  stakeholder_id UUID NOT NULL REFERENCES stakeholders(id),
  role VARCHAR(50) NOT NULL, -- sender, recipient, cc, bcc, attendee, etc.
  response_status VARCHAR(50), -- for meetings: accepted, declined, tentative
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(communication_id, stakeholder_id, role)
);

-- Attachments
CREATE TABLE IF NOT EXISTS communication_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  mime_type VARCHAR(100),
  file_path VARCHAR(1000) NOT NULL, -- Encrypted storage path
  file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash
  
  -- Security scanning
  scan_status VARCHAR(50) DEFAULT 'pending',
  scan_result JSONB DEFAULT '{}',
  scan_date TIMESTAMP WITH TIME ZONE,
  quarantined BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Communication tags (for classification and organization)
CREATE TABLE IF NOT EXISTS communication_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  tag_type VARCHAR(50) DEFAULT 'manual', -- manual, auto, system
  confidence DECIMAL(3,2), -- For AI-generated tags
  created_by UUID REFERENCES stakeholders(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(communication_id, tag)
);

-- Privilege log (audit trail for privilege decisions)
CREATE TABLE IF NOT EXISTS privilege_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  communication_id UUID NOT NULL REFERENCES communications(id),
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  reason TEXT,
  reviewed_by UUID NOT NULL REFERENCES stakeholders(id),
  review_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  rule_id VARCHAR(100), -- Reference to the privilege rule that was applied
  metadata JSONB DEFAULT '{}'
);

-- Monitoring alerts
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id),
  communication_id UUID REFERENCES communications(id),
  rule_type VARCHAR(50) NOT NULL, -- keyword, participant, pattern, volume, sentiment
  rule_name VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  
  -- Alert details
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  participants TEXT[], -- Array of participant names/emails
  
  -- Status
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES stakeholders(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES stakeholders(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Discovery exports (legal discovery requests)
CREATE TABLE IF NOT EXISTS discovery_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id),
  request_name VARCHAR(255) NOT NULL,
  requested_by UUID NOT NULL REFERENCES stakeholders(id),
  
  -- Export parameters
  date_range_start TIMESTAMP WITH TIME ZONE,
  date_range_end TIMESTAMP WITH TIME ZONE,
  participant_filter UUID[], -- Array of stakeholder IDs
  keyword_filter TEXT[],
  privilege_filter VARCHAR(50), -- include_privileged, exclude_privileged, privileged_only
  
  -- Export results
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  total_communications INTEGER,
  exported_communications INTEGER,
  format VARCHAR(50), -- native, pdf, load_file
  export_path VARCHAR(1000),
  file_hash VARCHAR(64),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Communication search index (for faster full-text search)
CREATE TABLE IF NOT EXISTS communication_search_index (
  communication_id UUID PRIMARY KEY REFERENCES communications(id) ON DELETE CASCADE,
  content_tokens tsvector,
  participant_tokens tsvector,
  metadata_tokens tsvector,
  tag_tokens tsvector,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Session management for real-time monitoring
CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id),
  session_name VARCHAR(255) NOT NULL,
  rules JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES stakeholders(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  stopped_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_communications_case_id ON communications(case_id);
CREATE INDEX IF NOT EXISTS idx_communications_timestamp ON communications(timestamp);
CREATE INDEX IF NOT EXISTS idx_communications_type ON communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_privilege_status ON communications(privilege_status);
CREATE INDEX IF NOT EXISTS idx_communications_thread_id ON communications(thread_id);
CREATE INDEX IF NOT EXISTS idx_communications_content_hash ON communications(content_hash);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_communications_search_vector ON communications USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_communication_search_content ON communication_search_index USING GIN(content_tokens);
CREATE INDEX IF NOT EXISTS idx_communication_search_participants ON communication_search_index USING GIN(participant_tokens);

-- Participant indexes
CREATE INDEX IF NOT EXISTS idx_communication_participants_comm_id ON communication_participants(communication_id);
CREATE INDEX IF NOT EXISTS idx_communication_participants_stakeholder_id ON communication_participants(stakeholder_id);

-- Stakeholder indexes
CREATE INDEX IF NOT EXISTS idx_stakeholders_email ON stakeholders(email);
CREATE INDEX IF NOT EXISTS idx_stakeholders_role ON stakeholders(role);
CREATE INDEX IF NOT EXISTS idx_stakeholders_relationship ON stakeholders(relationship);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_case_id ON monitoring_alerts(case_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_acknowledged ON monitoring_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity);

-- Attachment indexes
CREATE INDEX IF NOT EXISTS idx_communication_attachments_comm_id ON communication_attachments(communication_id);
CREATE INDEX IF NOT EXISTS idx_communication_attachments_hash ON communication_attachments(file_hash);

-- Triggers for maintaining search vectors and timestamps
CREATE OR REPLACE FUNCTION update_communication_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.classification_category, '')), 'C');
  
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_communication_search_vector
  BEFORE INSERT OR UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_communication_search_vector();

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stakeholders_updated_at
  BEFORE UPDATE ON stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for multi-tenant security
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_exports ENABLE ROW LEVEL SECURITY;

-- Views for common queries
CREATE VIEW communication_summary AS
SELECT 
  c.id,
  c.case_id,
  c.type,
  c.direction,
  c.timestamp,
  c.subject,
  c.privilege_status,
  c.classification_sensitivity,
  c.priority,
  array_agg(DISTINCT s.name) as participants,
  array_agg(DISTINCT ct.tag) as tags,
  count(ca.id) as attachment_count
FROM communications c
LEFT JOIN communication_participants cp ON c.id = cp.communication_id
LEFT JOIN stakeholders s ON cp.stakeholder_id = s.id
LEFT JOIN communication_tags ct ON c.id = ct.communication_id
LEFT JOIN communication_attachments ca ON c.id = ca.communication_id
GROUP BY c.id, c.case_id, c.type, c.direction, c.timestamp, c.subject, c.privilege_status, c.classification_sensitivity, c.priority;

-- View for privileged communications audit
CREATE VIEW privileged_communications_audit AS
SELECT 
  c.id,
  c.case_id,
  c.type,
  c.timestamp,
  c.privilege_status,
  pl.previous_status,
  pl.reason,
  s.name as reviewed_by,
  pl.review_date
FROM communications c
LEFT JOIN privilege_log pl ON c.id = pl.communication_id
LEFT JOIN stakeholders s ON pl.reviewed_by = s.id
WHERE c.privilege_status IN ('privileged', 'work_product');

-- Partitioning for large datasets (by year)
-- This would be implemented for production systems with high volume
-- CREATE TABLE communications_y2024 PARTITION OF communications
-- FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Grant permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO legal_app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO legal_app_user;