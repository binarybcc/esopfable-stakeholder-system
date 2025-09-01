# 🔐 ESOPFable Case Management System

**✅ PRODUCTION READY: Complete Stakeholder Management System**

A comprehensive whistleblower case management system designed for complex stakeholder coordination, secure document handling, and evidence preservation. **Currently featuring a fully operational stakeholder management interface with professional UI and complete backend API.**

## 🎉 **CURRENT STATUS: STAKEHOLDER SYSTEM COMPLETE**

### ✅ **What's Working NOW**
- **Professional Login Portal**: Full authentication at http://localhost:3000
- **Stakeholder Management**: Complete system with 6 categories and professional UI
- **Backend API**: REST endpoints with filtering, search, and demo data
- **Database Integration**: PostgreSQL with comprehensive stakeholder schema
- **Real-time Features**: WebSocket connections ready for live updates

## 🚀 **INSTANT SETUP** - Get Running in 1 Command

### **Current Working Implementation**

```bash
# Clone and start the complete system
git clone https://github.com/binarybcc/esopfable-stakeholder-system.git
cd esopfable-stakeholder-system
./start-dev.sh  # Starts everything automatically!
```

**Then access:**
- **Main App**: http://localhost:3000 (Professional login portal)
- **API**: http://localhost:3001/health
- **Stakeholder Management**: http://localhost:3000/stakeholders

### **Demo Credentials**
- **Email**: `admin@esopfable.com`
- **Password**: `SecureAdmin123!`

## 🎯 **Feature Demonstration**

### **Current Features (All Working)**
1. **Login** → Professional authentication portal
2. **Dashboard** → Click "Stakeholder Management" 
3. **Stakeholder System**:
   - View 3 demo stakeholders across different categories
   - Filter by category (Legal Team, Government, Witnesses, etc.)
   - Search by name, organization, title
   - Click any stakeholder for detailed view
   - Security level indicators (Standard/Restricted/High)

### **Legacy Setup Options**

### Option 1: Manual Local Development

```bash
# 1. Install dependencies
cd backend && npm install
cd ../src/frontend && npm install

# 2. Start services separately
cd backend && npm run dev        # API on :3001
cd ../src/frontend && npm start  # UI on :3000
```

### Option 2: Docker Compose (Production-Ready)

```bash
# 1. Build and start all services
docker-compose up -d

# 2. Run initial setup
docker-compose exec api npm run migrate
docker-compose exec api npm run seed

# Access at: http://localhost:3000
```

### Option 3: Kubernetes (Enterprise Scale)

```bash
# 1. Apply configurations
kubectl apply -f devops/k8s/

# 2. Get service URL
kubectl get services esopfable-frontend

# 3. Run migrations
kubectl exec -it deployment/esopfable-api -- npm run migrate
```

## 🔧 Environment Configuration

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/esopfable
DB_HOST=localhost
DB_PORT=5432
DB_NAME=esopfable
DB_USER=postgres
DB_PASSWORD=your_secure_password

# JWT Authentication
JWT_SECRET=your-256-bit-secret-key-here
JWT_EXPIRES_IN=24h

# Encryption
ENCRYPTION_KEY=your-64-char-hex-encryption-key

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50MB

# Redis (for sessions/cache)
REDIS_URL=redis://localhost:6379

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Security
RATE_LIMIT_WINDOW=15min
RATE_LIMIT_MAX=100
SESSION_SECRET=another-secure-secret

# External APIs
VIRUS_SCAN_ENABLED=true
BACKUP_ENABLED=true
AUDIT_LOG_RETENTION=365
```

### Frontend (.env)

```bash
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
REACT_APP_ENCRYPTION_ENABLED=true
REACT_APP_FILE_UPLOAD_MAX_SIZE=50
REACT_APP_ENVIRONMENT=development
```

## 👥 Default Users & Access

### Admin Account
- **Email:** admin@esopfable.com
- **Password:** SecureAdmin123!
- **Role:** admin
- **Access:** Full system access

### Case Manager Account
- **Email:** manager@esopfable.com
- **Password:** CaseManager123!
- **Role:** case_manager
- **Access:** Stakeholder & document management

### Legal Team Account
- **Email:** legal@esopfable.com
- **Password:** LegalTeam123!
- **Role:** legal_team
- **Access:** Evidence & legal documents

## 🎯 System Features & Usage

### 1. **Stakeholder Management**
- Navigate to `/stakeholders`
- Create stakeholders across 6 categories:
  - Legal Team (attorneys, specialists)
  - Government Entities (investigators, prosecutors)  
  - ESOP Participants (employees, beneficiaries)
  - Key Witnesses (insiders, document holders)
  - Media Contacts (journalists, outlets)
  - Opposition (potential threats)

### 2. **Document Management**
- Navigate to `/documents`
- Upload files with automatic:
  - Virus scanning (ClamAV integration)
  - Encryption at rest
  - Access logging
  - Version control
- Document types: Evidence, Legal, Communications, Reports

### 3. **Communication Tracking**
- Navigate to `/communications`
- Log all interactions:
  - Meetings, calls, emails
  - Stakeholder communications
  - Legal correspondence
  - Media interactions

### 4. **Task Management**
- Navigate to `/tasks`
- Create and assign tasks:
  - Investigation milestones
  - Document collection
  - Legal deadlines
  - PR coordination

### 5. **Evidence Chain**
- Navigate to `/evidence`
- Maintain custody chain:
  - Cryptographic integrity verification
  - Access audit trails  
  - Evidence relationships
  - Court-ready documentation

### 6. **Risk Monitoring**
- Navigate to `/risk-monitoring`
- Track threats and risks:
  - Retaliation indicators
  - Evidence destruction risks
  - Stakeholder safety
  - Case exposure risks

### 7. **PR Message Management**
- Navigate to `/pr-messages`
- Coordinate public communications:
  - Message approval workflows
  - Stakeholder-specific messaging
  - Crisis communication plans

## 🏗️ Production Deployment Options

### AWS Deployment

```bash
# 1. Use Terraform for infrastructure
cd devops/terraform
terraform init
terraform plan
terraform apply

# 2. Deploy with ECS/EKS
# Infrastructure includes:
# - RDS PostgreSQL
# - ElastiCache Redis  
# - S3 for file storage
# - CloudFront CDN
# - Application Load Balancer
# - Auto Scaling Groups
```

### Google Cloud Platform

```bash
# 1. Set up GKE cluster
gcloud container clusters create esopfable-cluster --num-nodes=3

# 2. Deploy application
kubectl apply -f devops/k8s/
```

### Microsoft Azure

```bash
# 1. Create AKS cluster
az aks create --resource-group esopfable --name esopfable-aks --node-count 3

# 2. Deploy services
kubectl apply -f devops/k8s/
```

### Self-Hosted (On-Premise)

```bash
# 1. Prepare Ubuntu/RHEL server
# 2. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Deploy application
docker-compose -f docker-compose.prod.yml up -d
```

## 🔒 Security Considerations

### Required Setup
1. **SSL/TLS certificates** - Use Let's Encrypt or commercial certs
2. **Firewall configuration** - Restrict database access
3. **Backup strategy** - Automated daily backups
4. **Monitoring** - Set up log aggregation and alerts
5. **Virus scanning** - Install ClamAV on production servers

### Security Checklist
- [ ] Change all default passwords
- [ ] Generate strong encryption keys
- [ ] Configure proper file permissions
- [ ] Set up fail2ban for brute force protection
- [ ] Enable audit logging
- [ ] Configure secure headers
- [ ] Set up automated security updates

## 📊 Monitoring & Maintenance

### Health Checks
- API Health: `GET /api/health`
- Database: Built-in connection monitoring
- Redis: Session store monitoring
- File System: Storage space alerts

### Log Locations
- Application logs: `./logs/app.log`
- Audit logs: Database table `audit_logs`
- Nginx logs: `/var/log/nginx/`
- Database logs: PostgreSQL data directory

### Backup Strategy
- **Database**: Daily automated backups with 30-day retention
- **Files**: Encrypted backups to secure storage
- **Configuration**: Version controlled in Git
- **Recovery**: Tested restoration procedures

## 🆘 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL service
sudo systemctl status postgresql
# Verify connection string in .env
# Check firewall rules
```

**File Upload Errors**
```bash
# Check disk space
df -h
# Verify upload directory permissions
ls -la uploads/
# Check virus scanner
clamscan --version
```

**Frontend Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📞 Support & Documentation

- **API Documentation**: http://localhost:3001/api-docs (Swagger UI)
- **System Architecture**: `docs/architecture.md`
- **Security Guide**: `docs/security.md`
- **User Manual**: `docs/user-guide.md`
- **Developer Guide**: `docs/development.md`

## 🔐 Legal & Compliance

This system is designed for legitimate whistleblower protection and case management. Ensure compliance with:
- SOX (Sarbanes-Oxley) requirements
- GDPR data protection
- Local whistleblower protection laws
- Industry-specific regulations

---

**⚠️ Security Notice**: This system handles sensitive legal and personal information. Always follow security best practices and consult with legal counsel regarding data handling requirements."