#!/bin/bash

# Simplified ESOPFable Setup - Avoiding problematic dependencies
set -e

echo "🔐 ESOPFable Case Management System - Simplified Local Setup"
echo "==========================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js found: $NODE_VERSION"

# Create directories
print_status "Creating directories..."
mkdir -p backend/{logs,uploads,temp} scripts

# Generate keys
print_status "Generating secure keys..."
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# Setup Docker Postgres (easiest option)
if command -v docker >/dev/null 2>&1; then
    print_status "Starting PostgreSQL with Docker..."
    
    # Stop existing container if running
    docker stop esopfable-postgres 2>/dev/null || true
    docker rm esopfable-postgres 2>/dev/null || true
    
    # Start fresh container
    docker run --name esopfable-postgres \
        -e POSTGRES_PASSWORD=esopfable123 \
        -e POSTGRES_DB=esopfable \
        -e POSTGRES_USER=esopfable \
        -p 5432:5432 \
        -d postgres:15
    
    print_success "PostgreSQL started with Docker"
    DB_URL="postgresql://esopfable:esopfable123@localhost:5432/esopfable"
    
    # Wait for postgres
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 8
else
    print_warning "Docker not found. You'll need to install PostgreSQL manually."
    print_status "On macOS: brew install postgresql@15"
    print_status "On Linux: sudo apt-get install postgresql"
    exit 1
fi

# Create backend .env
print_status "Creating backend configuration..."
cat > backend/.env << EOF
# Database
DATABASE_URL=${DB_URL}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=esopfable
DB_USER=esopfable
DB_PASSWORD=esopfable123

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}

# Server
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Features (simplified for local dev)
VIRUS_SCAN_ENABLED=false
EMAIL_ENABLED=false
BACKUP_ENABLED=false
AUDIT_LOG_ENABLED=true
SWAGGER_ENABLED=true

# Files
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
TEMP_DIR=./temp

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log
EOF

# Create frontend .env  
print_status "Creating frontend configuration..."
cat > src/frontend/.env << EOF
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
REACT_APP_ENCRYPTION_ENABLED=true
REACT_APP_ENVIRONMENT=development
REACT_APP_MAX_FILE_SIZE=50
GENERATE_SOURCEMAP=true
EOF

# Install backend dependencies (avoiding problematic ones)
print_status "Installing backend dependencies..."
cd backend

# Create a clean package.json without problematic dependencies
cat > package-clean.json << 'EOF'
{
  "name": "case-management-api",
  "version": "1.0.0",
  "description": "Secure Node.js/Express API for case management system",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "migrate": "knex migrate:latest",
    "migrate:rollback": "knex migrate:rollback",
    "seed": "knex seed:run"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5", 
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "knex": "^3.0.1",
    "pg": "^8.11.3",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.32.6",
    "socket.io": "^4.7.4",
    "winston": "^3.11.0",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "swagger-ui-express": "^5.0.0",
    "swagger-jsdoc": "^6.2.8",
    "dotenv": "^16.3.1",
    "joi": "^17.11.0",
    "uuid": "^9.0.1",
    "nodemailer": "^6.9.7"
  },
  "devDependencies": {
    "@types/node": "^20.8.7",
    "@types/express": "^4.17.20",
    "@types/cors": "^2.8.15",
    "@types/bcryptjs": "^2.4.5",
    "@types/jsonwebtoken": "^9.0.4",
    "@types/multer": "^1.4.9",
    "@types/uuid": "^9.0.6",
    "typescript": "^5.2.2",
    "nodemon": "^3.0.1",
    "ts-node": "^10.9.1"
  }
}
EOF

# Use clean package.json
cp package-clean.json package.json
rm package-clean.json

# Install dependencies
npm install
cd ..

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd src/frontend

# Create a minimal package.json for frontend
cat > package.json << 'EOF'
{
  "name": "esopfable-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@types/node": "^16.18.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "react-router-dom": "^6.8.0",
    "@tanstack/react-query": "^4.24.0",
    "socket.io-client": "^4.7.4",
    "react-hot-toast": "^2.4.1",
    "axios": "^1.3.0",
    "typescript": "^4.9.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "dev": "react-scripts start"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF

npm install
cd ../..

# Run migrations
print_status "Setting up database..."
cd backend
sleep 3  # Extra wait for postgres
npm run migrate || true
npm run seed || true
cd ..

# Create start script
print_status "Creating startup script..."
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting ESOPFable Case Management System..."

# Start backend
echo "🔧 Starting backend API server..."
cd backend && npm run dev &

# Wait for backend
sleep 5

# Start frontend  
echo "🎨 Starting frontend..."
cd src/frontend && npm start &

echo "✅ System started!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "📚 API Docs: http://localhost:3001/api-docs"
echo ""
echo "Default login:"
echo "Email: admin@esopfable.com"
echo "Password: SecureAdmin123!"

wait
EOF

chmod +x start-dev.sh

print_success "✅ Setup complete!"
echo ""
echo "🚀 To start the system:"
echo "   ./start-dev.sh"
echo ""  
echo "🌐 Access URLs:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:3001" 
echo "   Docs: http://localhost:3001/api-docs"
echo ""
echo "🔑 Default Login:"
echo "   Email: admin@esopfable.com"
echo "   Password: SecureAdmin123!"
echo ""
print_warning "Note: Some advanced features are disabled for easier setup"
print_warning "Virus scanning, email, and some optional features are turned off"