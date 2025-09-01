#!/bin/bash

# ESOPFable Case Management System - Local Setup Script
# This script sets up the development environment on macOS/Linux

set -e  # Exit on any error

echo "🔐 ESOPFable Case Management System - Local Setup"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on macOS or Linux
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN";;
esac

print_status "Detected OS: $MACHINE"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm not found. Please install npm"
        exit 1
    fi
    
    # Check PostgreSQL
    if command_exists psql; then
        PSQL_VERSION=$(psql --version | head -n1)
        print_success "PostgreSQL found: $PSQL_VERSION"
    else
        print_warning "PostgreSQL not found. We'll help you set it up."
        INSTALL_POSTGRES=true
    fi
    
    # Check Docker (optional)
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker found: $DOCKER_VERSION"
        USE_DOCKER_POSTGRES=true
    else
        print_warning "Docker not found. Will use local PostgreSQL installation."
        USE_DOCKER_POSTGRES=false
    fi
    
    # Check Redis (optional but recommended)
    if command_exists redis-server; then
        print_success "Redis found"
    else
        print_warning "Redis not found. Some features may be limited."
    fi
}

# Install PostgreSQL based on OS
install_postgres() {
    if [ "$INSTALL_POSTGRES" = true ]; then
        print_status "Installing PostgreSQL..."
        
        if [ "$MACHINE" = "Mac" ]; then
            if command_exists brew; then
                brew install postgresql@15
                brew services start postgresql@15
                print_success "PostgreSQL installed and started via Homebrew"
            else
                print_error "Homebrew not found. Please install PostgreSQL manually or install Homebrew first."
                exit 1
            fi
        elif [ "$MACHINE" = "Linux" ]; then
            # Ubuntu/Debian
            if command_exists apt-get; then
                sudo apt-get update
                sudo apt-get install -y postgresql postgresql-contrib
                sudo systemctl start postgresql
                sudo systemctl enable postgresql
                print_success "PostgreSQL installed and started via apt"
            # CentOS/RHEL/Fedora
            elif command_exists yum; then
                sudo yum install -y postgresql-server postgresql-contrib
                sudo postgresql-setup initdb
                sudo systemctl start postgresql
                sudo systemctl enable postgresql
                print_success "PostgreSQL installed and started via yum"
            else
                print_error "Could not detect package manager. Please install PostgreSQL manually."
                exit 1
            fi
        fi
    fi
}

# Setup PostgreSQL database
setup_database() {
    print_status "Setting up database..."
    
    if [ "$USE_DOCKER_POSTGRES" = true ]; then
        print_status "Starting PostgreSQL with Docker..."
        docker run --name esopfable-postgres \
            -e POSTGRES_PASSWORD=esopfable123 \
            -e POSTGRES_DB=esopfable \
            -e POSTGRES_USER=esopfable \
            -p 5432:5432 \
            -d postgres:15
        
        # Wait for postgres to start
        print_status "Waiting for PostgreSQL to be ready..."
        sleep 10
        
        DB_URL="postgresql://esopfable:esopfable123@localhost:5432/esopfable"
    else
        # Create database and user
        print_status "Creating database and user..."
        sudo -u postgres psql -c "CREATE DATABASE esopfable;" 2>/dev/null || true
        sudo -u postgres psql -c "CREATE USER esopfable WITH ENCRYPTED PASSWORD 'esopfable123';" 2>/dev/null || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE esopfable TO esopfable;" 2>/dev/null || true
        
        DB_URL="postgresql://esopfable:esopfable123@localhost:5432/esopfable"
    fi
    
    print_success "Database setup complete"
}

# Setup Redis (optional)
setup_redis() {
    if [ "$USE_DOCKER_POSTGRES" = true ]; then
        print_status "Starting Redis with Docker..."
        docker run --name esopfable-redis -p 6379:6379 -d redis:7-alpine
        REDIS_URL="redis://localhost:6379"
    else
        # Try to start local Redis
        if command_exists redis-server; then
            if [ "$MACHINE" = "Mac" ]; then
                brew services start redis 2>/dev/null || true
            elif [ "$MACHINE" = "Linux" ]; then
                sudo systemctl start redis 2>/dev/null || true
            fi
            REDIS_URL="redis://localhost:6379"
        else
            REDIS_URL=""
        fi
    fi
}

# Generate secure keys
generate_keys() {
    print_status "Generating secure keys..."
    
    # Generate JWT secret (64 characters)
    JWT_SECRET=$(openssl rand -hex 32)
    
    # Generate encryption key (64 characters)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    # Generate session secret (64 characters)
    SESSION_SECRET=$(openssl rand -hex 32)
    
    print_success "Security keys generated"
}

# Create backend environment file
create_backend_env() {
    print_status "Creating backend environment configuration..."
    
    cat > backend/.env << EOF
# Database Configuration
DATABASE_URL=${DB_URL}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=esopfable
DB_USER=esopfable
DB_PASSWORD=esopfable123

# JWT Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

# Encryption
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Server Configuration
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Redis Configuration
REDIS_URL=${REDIS_URL}

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
TEMP_DIR=./temp

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
SESSION_SECRET=${SESSION_SECRET}

# Feature Flags
VIRUS_SCAN_ENABLED=false
EMAIL_ENABLED=false
BACKUP_ENABLED=true
AUDIT_LOG_ENABLED=true

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# Development Settings
SWAGGER_ENABLED=true
CORS_ENABLED=true
TRUST_PROXY=false

# Email Configuration (Optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# FROM_EMAIL=noreply@esopfable.com
# FROM_NAME=ESOPFable System

# External Services (Optional)
# BACKUP_S3_BUCKET=esopfable-backups
# BACKUP_S3_REGION=us-west-2
# MONITORING_ENABLED=false
EOF
    
    print_success "Backend environment file created"
}

# Create frontend environment file
create_frontend_env() {
    print_status "Creating frontend environment configuration..."
    
    cat > src/frontend/.env << EOF
# API Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001

# Feature Flags
REACT_APP_ENCRYPTION_ENABLED=true
REACT_APP_REAL_TIME_ENABLED=true
REACT_APP_PWA_ENABLED=false

# File Upload
REACT_APP_MAX_FILE_SIZE=50
REACT_APP_ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif,txt,csv

# UI Configuration
REACT_APP_THEME=light
REACT_APP_SIDEBAR_COLLAPSED=false

# Development
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG_MODE=true
GENERATE_SOURCEMAP=true

# Optional: Analytics & Monitoring
# REACT_APP_ANALYTICS_ID=
# REACT_APP_SENTRY_DSN=
EOF
    
    print_success "Frontend environment file created"
}

# Install dependencies
install_dependencies() {
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    print_status "Installing frontend dependencies..."
    cd src/frontend
    npm install
    cd ../..
    
    print_success "Dependencies installed"
}

# Run database migrations and seeds
setup_database_schema() {
    print_status "Running database migrations..."
    cd backend
    
    # Wait a bit more for database to be fully ready
    sleep 5
    
    # Run migrations
    npm run migrate
    
    print_status "Seeding initial data..."
    npm run seed
    
    cd ..
    print_success "Database schema and seed data setup complete"
}

# Create startup script
create_startup_script() {
    print_status "Creating startup script..."
    
    cat > start-dev.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting ESOPFable Case Management System..."

# Function to handle cleanup
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    jobs -p | xargs -r kill
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting backend API server..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend development server..."
cd src/frontend && npm run dev &
FRONTEND_PID=$!

# Wait for all background processes
wait
EOF
    
    chmod +x start-dev.sh
    
    print_success "Startup script created (start-dev.sh)"
}

# Create useful development scripts
create_dev_scripts() {
    print_status "Creating development scripts..."
    
    # Database reset script
    cat > scripts/reset-db.sh << 'EOF'
#!/bin/bash
echo "🗄️ Resetting database..."
cd backend
npm run migrate:rollback
npm run migrate
npm run seed
echo "✅ Database reset complete"
EOF
    chmod +x scripts/reset-db.sh
    
    # Logs viewer script
    cat > scripts/view-logs.sh << 'EOF'
#!/bin/bash
echo "📋 Viewing application logs..."
tail -f backend/logs/app.log
EOF
    chmod +x scripts/view-logs.sh
    
    # Health check script
    cat > scripts/health-check.sh << 'EOF'
#!/bin/bash
echo "🏥 Checking system health..."

# Check backend
echo -n "Backend API: "
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Running"
else
    echo "❌ Down"
fi

# Check frontend
echo -n "Frontend: "
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Running"  
else
    echo "❌ Down"
fi

# Check database
echo -n "Database: "
if cd backend && npm run db:test > /dev/null 2>&1; then
    echo "✅ Connected"
else
    echo "❌ Connection failed"
fi
EOF
    chmod +x scripts/health-check.sh
    
    print_success "Development scripts created"
}

# Main setup function
main() {
    print_status "Starting ESOPFable Case Management System setup..."
    
    # Create necessary directories
    mkdir -p backend/logs backend/uploads backend/temp
    mkdir -p scripts
    
    check_prerequisites
    
    if [ "$INSTALL_POSTGRES" = true ]; then
        install_postgres
    fi
    
    setup_database
    setup_redis
    generate_keys
    create_backend_env
    create_frontend_env
    install_dependencies
    setup_database_schema
    create_startup_script
    create_dev_scripts
    
    print_success "Setup complete! 🎉"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Review configuration files:"
    echo "     - backend/.env"
    echo "     - src/frontend/.env"
    echo ""
    echo "  2. Start the development servers:"
    echo "     ./start-dev.sh"
    echo ""
    echo "  3. Access the application:"
    echo "     - Frontend: http://localhost:3000"
    echo "     - API: http://localhost:3001"
    echo "     - API Docs: http://localhost:3001/api-docs"
    echo ""
    echo "  4. Default login credentials:"
    echo "     - Admin: admin@esopfable.com / SecureAdmin123!"
    echo "     - Manager: manager@esopfable.com / CaseManager123!"
    echo ""
    echo "  5. Useful commands:"
    echo "     - Reset database: ./scripts/reset-db.sh"
    echo "     - View logs: ./scripts/view-logs.sh"
    echo "     - Health check: ./scripts/health-check.sh"
    echo ""
    print_warning "Remember to change default passwords in production!"
}

# Run main function
main "$@"