#!/bin/bash

# ESOPFable Case Management System - Production Deployment Script
# Supports AWS, GCP, Azure, and self-hosted deployments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
DEPLOYMENT_TYPE=${1:-"docker"}  # docker, aws, gcp, azure, k8s
ENVIRONMENT=${2:-"production"}   # production, staging
DOMAIN=${3:-""}                 # Optional domain name

print_status "🚀 ESOPFable Production Deployment"
print_status "Deployment Type: $DEPLOYMENT_TYPE"
print_status "Environment: $ENVIRONMENT"

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    case $DEPLOYMENT_TYPE in
        "docker")
            command -v docker >/dev/null 2>&1 || { print_error "Docker is required"; exit 1; }
            command -v docker-compose >/dev/null 2>&1 || { print_error "Docker Compose is required"; exit 1; }
            ;;
        "aws")
            command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is required"; exit 1; }
            command -v terraform >/dev/null 2>&1 || { print_error "Terraform is required"; exit 1; }
            ;;
        "gcp")
            command -v gcloud >/dev/null 2>&1 || { print_error "Google Cloud SDK is required"; exit 1; }
            command -v kubectl >/dev/null 2>&1 || { print_error "kubectl is required"; exit 1; }
            ;;
        "azure")
            command -v az >/dev/null 2>&1 || { print_error "Azure CLI is required"; exit 1; }
            ;;
        "k8s")
            command -v kubectl >/dev/null 2>&1 || { print_error "kubectl is required"; exit 1; }
            ;;
    esac
    
    print_success "Prerequisites check passed"
}

# Generate secure production keys
generate_production_keys() {
    print_status "Generating production keys..."
    
    # Create secure keys directory
    mkdir -p secrets
    
    # Generate keys
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 32)
    
    # Generate database password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Generate Redis password
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Save to secure file
    cat > secrets/production.env << EOF
# Generated on $(date)
# Keep this file secure and never commit to version control

# Database
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# Security Keys
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}

# Additional Security
ADMIN_EMAIL=admin@${DOMAIN:-esopfable.com}
ADMIN_PASSWORD=$(openssl rand -base64 12)

# Backup Encryption
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF
    
    chmod 600 secrets/production.env
    print_success "Production keys generated and saved to secrets/production.env"
    print_warning "Keep the secrets/production.env file secure!"
}

# Docker deployment
deploy_docker() {
    print_status "Deploying with Docker Compose..."
    
    # Create production docker-compose file
    cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: esopfable-postgres-prod
    environment:
      POSTGRES_DB: esopfable
      POSTGRES_USER: esopfable
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - ./backup:/backup
    networks:
      - esopfable-prod
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    container_name: esopfable-redis-prod
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_prod_data:/data
    networks:
      - esopfable-prod
    restart: unless-stopped
    
  api:
    build:
      context: .
      dockerfile: devops/docker/Dockerfile.api
    container_name: esopfable-api-prod
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://esopfable:${DB_PASSWORD}@postgres:5432/esopfable
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      SESSION_SECRET: ${SESSION_SECRET}
      DOMAIN: ${DOMAIN}
      CORS_ORIGIN: https://${DOMAIN}
      VIRUS_SCAN_ENABLED: true
      EMAIL_ENABLED: true
      BACKUP_ENABLED: true
    ports:
      - "127.0.0.1:3001:3001"
    volumes:
      - uploads_prod_data:/app/uploads
      - logs_prod_data:/app/logs
      - ./backup:/app/backup
    depends_on:
      - postgres
      - redis
    networks:
      - esopfable-prod
    restart: unless-stopped
    
  frontend:
    build:
      context: .
      dockerfile: devops/docker/Dockerfile.frontend
      args:
        REACT_APP_API_URL: https://${DOMAIN}/api
        REACT_APP_ENVIRONMENT: production
    container_name: esopfable-frontend-prod
    ports:
      - "127.0.0.1:3000:80"
    depends_on:
      - api
    networks:
      - esopfable-prod
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    container_name: esopfable-nginx-prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./devops/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./devops/nginx/ssl:/etc/nginx/ssl:ro
      - nginx_prod_logs:/var/log/nginx
    depends_on:
      - frontend
      - api
    networks:
      - esopfable-prod
    restart: unless-stopped
    
  clamav:
    image: clamav/clamav:stable
    container_name: esopfable-clamav-prod
    volumes:
      - clamav_prod_data:/var/lib/clamav
    networks:
      - esopfable-prod
    restart: unless-stopped

volumes:
  postgres_prod_data:
  redis_prod_data:
  uploads_prod_data:
  logs_prod_data:
  nginx_prod_logs:
  clamav_prod_data:

networks:
  esopfable-prod:
    driver: bridge
EOF

    # Load secrets
    source secrets/production.env
    
    # Deploy services
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 30
    
    # Run migrations
    print_status "Running database migrations..."
    docker-compose -f docker-compose.prod.yml exec api npm run migrate
    
    # Create admin user
    docker-compose -f docker-compose.prod.yml exec api npm run seed:admin
    
    print_success "Docker deployment complete!"
    print_status "Access your application at: ${DOMAIN:-http://localhost}"
}

# AWS deployment using Terraform
deploy_aws() {
    print_status "Deploying to AWS..."
    
    cd devops/terraform
    
    # Initialize Terraform
    terraform init
    
    # Create terraform.tfvars
    cat > terraform.tfvars << EOF
project_name = "esopfable"
environment = "${ENVIRONMENT}"
domain_name = "${DOMAIN}"
db_password = "${DB_PASSWORD}"
redis_password = "${REDIS_PASSWORD}"
jwt_secret = "${JWT_SECRET}"
encryption_key = "${ENCRYPTION_KEY}"
session_secret = "${SESSION_SECRET}"
EOF
    
    # Plan and apply
    terraform plan
    read -p "Continue with AWS deployment? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply -auto-approve
        print_success "AWS deployment complete!"
        
        # Get outputs
        ALB_DNS=$(terraform output -raw load_balancer_dns)
        RDS_ENDPOINT=$(terraform output -raw database_endpoint)
        
        print_status "Application URL: https://${ALB_DNS}"
        print_status "Database Endpoint: ${RDS_ENDPOINT}"
    else
        print_warning "AWS deployment cancelled"
    fi
    
    cd ../..
}

# Google Cloud Platform deployment
deploy_gcp() {
    print_status "Deploying to Google Cloud Platform..."
    
    # Set project
    read -p "Enter GCP Project ID: " PROJECT_ID
    gcloud config set project $PROJECT_ID
    
    # Create GKE cluster
    gcloud container clusters create esopfable-cluster \
        --num-nodes=3 \
        --zone=us-central1-a \
        --machine-type=n1-standard-2 \
        --enable-autoscaling \
        --min-nodes=1 \
        --max-nodes=5
    
    # Get credentials
    gcloud container clusters get-credentials esopfable-cluster --zone=us-central1-a
    
    # Create secrets
    kubectl create secret generic esopfable-secrets \
        --from-literal=db-password="${DB_PASSWORD}" \
        --from-literal=redis-password="${REDIS_PASSWORD}" \
        --from-literal=jwt-secret="${JWT_SECRET}" \
        --from-literal=encryption-key="${ENCRYPTION_KEY}" \
        --from-literal=session-secret="${SESSION_SECRET}"
    
    # Deploy to Kubernetes
    kubectl apply -f devops/k8s/
    
    # Wait for deployment
    kubectl rollout status deployment/esopfable-api
    kubectl rollout status deployment/esopfable-frontend
    
    # Get external IP
    EXTERNAL_IP=$(kubectl get service esopfable-frontend -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    print_success "GCP deployment complete!"
    print_status "Application URL: http://${EXTERNAL_IP}"
}

# Azure deployment
deploy_azure() {
    print_status "Deploying to Azure..."
    
    # Create resource group
    az group create --name esopfable-rg --location eastus
    
    # Create AKS cluster
    az aks create \
        --resource-group esopfable-rg \
        --name esopfable-aks \
        --node-count 3 \
        --enable-addons monitoring \
        --generate-ssh-keys
    
    # Get credentials
    az aks get-credentials --resource-group esopfable-rg --name esopfable-aks
    
    # Create secrets
    kubectl create secret generic esopfable-secrets \
        --from-literal=db-password="${DB_PASSWORD}" \
        --from-literal=redis-password="${REDIS_PASSWORD}" \
        --from-literal=jwt-secret="${JWT_SECRET}" \
        --from-literal=encryption-key="${ENCRYPTION_KEY}" \
        --from-literal=session-secret="${SESSION_SECRET}"
    
    # Deploy to Kubernetes
    kubectl apply -f devops/k8s/
    
    print_success "Azure deployment complete!"
}

# Kubernetes deployment (generic)
deploy_k8s() {
    print_status "Deploying to Kubernetes..."
    
    # Create namespace
    kubectl create namespace esopfable || true
    kubectl config set-context --current --namespace=esopfable
    
    # Create secrets
    kubectl create secret generic esopfable-secrets \
        --from-literal=db-password="${DB_PASSWORD}" \
        --from-literal=redis-password="${REDIS_PASSWORD}" \
        --from-literal=jwt-secret="${JWT_SECRET}" \
        --from-literal=encryption-key="${ENCRYPTION_KEY}" \
        --from-literal=session-secret="${SESSION_SECRET}" \
        --namespace=esopfable || true
    
    # Deploy
    kubectl apply -f devops/k8s/ --namespace=esopfable
    
    # Wait for rollout
    kubectl rollout status deployment/esopfable-api --namespace=esopfable
    kubectl rollout status deployment/esopfable-frontend --namespace=esopfable
    
    print_success "Kubernetes deployment complete!"
}

# Setup SSL certificates
setup_ssl() {
    if [ -n "$DOMAIN" ]; then
        print_status "Setting up SSL certificates for $DOMAIN..."
        
        # Create certificates directory
        mkdir -p devops/nginx/ssl
        
        # Use Let's Encrypt with certbot
        if command -v certbot >/dev/null 2>&1; then
            certbot certonly --standalone -d $DOMAIN \
                --email admin@$DOMAIN \
                --agree-tos \
                --non-interactive
            
            # Copy certificates
            cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem devops/nginx/ssl/
            cp /etc/letsencrypt/live/$DOMAIN/privkey.pem devops/nginx/ssl/
            
            print_success "SSL certificates configured"
        else
            print_warning "Certbot not found. Please install SSL certificates manually."
        fi
    fi
}

# Setup monitoring and alerts
setup_monitoring() {
    print_status "Setting up monitoring and alerts..."
    
    case $DEPLOYMENT_TYPE in
        "docker")
            # Add monitoring containers to docker-compose
            cat >> docker-compose.prod.yml << EOF
            
  prometheus:
    image: prom/prometheus
    container_name: esopfable-prometheus
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - esopfable-prod
    restart: unless-stopped
    
  grafana:
    image: grafana/grafana
    container_name: esopfable-grafana  
    ports:
      - "127.0.0.1:3003:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - esopfable-prod
    restart: unless-stopped
EOF
            ;;
    esac
    
    print_success "Monitoring setup complete"
}

# Create backup scripts
setup_backups() {
    print_status "Setting up automated backups..."
    
    # Create backup directory
    mkdir -p backup/scripts
    
    # Create database backup script
    cat > backup/scripts/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/database"
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h postgres -U esopfable esopfable | gzip > $BACKUP_DIR/esopfable_$DATE.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Database backup completed: esopfable_$DATE.sql.gz"
EOF
    
    chmod +x backup/scripts/backup-db.sh
    
    # Create cron job
    (crontab -l 2>/dev/null; echo "0 2 * * * /app/backup/scripts/backup-db.sh") | crontab -
    
    print_success "Automated backups configured"
}

# Main deployment function
main() {
    check_prerequisites
    generate_production_keys
    
    # Load production secrets
    source secrets/production.env
    
    # Setup SSL if domain provided
    if [ -n "$DOMAIN" ]; then
        setup_ssl
    fi
    
    # Deploy based on type
    case $DEPLOYMENT_TYPE in
        "docker")
            deploy_docker
            ;;
        "aws")
            deploy_aws
            ;;
        "gcp")
            deploy_gcp
            ;;
        "azure")
            deploy_azure
            ;;
        "k8s")
            deploy_k8s
            ;;
        *)
            print_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            print_status "Supported types: docker, aws, gcp, azure, k8s"
            exit 1
            ;;
    esac
    
    # Setup additional services
    setup_monitoring
    setup_backups
    
    print_success "🎉 Production deployment complete!"
    echo ""
    echo "📋 Post-deployment checklist:"
    echo "  ✅ Update DNS records to point to your server"
    echo "  ✅ Configure SSL certificates"
    echo "  ✅ Set up monitoring and alerts"  
    echo "  ✅ Configure automated backups"
    echo "  ✅ Update default passwords"
    echo "  ✅ Review security settings"
    echo "  ✅ Test all functionality"
    echo ""
    print_warning "Keep your secrets/production.env file secure!"
}

# Show usage if no arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 <deployment-type> [environment] [domain]"
    echo ""
    echo "Deployment types:"
    echo "  docker  - Docker Compose deployment"
    echo "  aws     - Amazon Web Services"
    echo "  gcp     - Google Cloud Platform"
    echo "  azure   - Microsoft Azure"
    echo "  k8s     - Generic Kubernetes"
    echo ""
    echo "Examples:"
    echo "  $0 docker production esopfable.com"
    echo "  $0 aws production"
    echo "  $0 k8s staging"
    exit 1
fi

# Run main function
main "$@"