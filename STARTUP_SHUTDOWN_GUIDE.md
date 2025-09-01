# 🔧 ESOPFable System Startup & Shutdown Guide

## 📍 **Current Status: SYSTEM SHUT DOWN**
*Last Shutdown: September 1, 2025 - 9:10 PM EDT*

---

## 🚀 **STARTUP INSTRUCTIONS (Next Session)**

### **Quick Start (Recommended)**
```bash
# Navigate to project directory
cd /Users/user/Development/work/esopfable

# Start everything with one command
./start-dev.sh
```

### **Manual Startup (Step by Step)**
```bash
# 1. Navigate to project root
cd /Users/user/Development/work/esopfable

# 2. Start PostgreSQL container
docker start esopfable-postgres

# 3. Wait for database to be ready (optional check)
docker logs esopfable-postgres

# 4. Start backend API (Terminal 1)
cd backend
npm run dev
# Should start on http://localhost:3001

# 5. Start frontend React app (Terminal 2 - new terminal)
cd ../src/frontend  
npm start
# Should start on http://localhost:3000
```

### **Verification Steps**
```bash
# Test backend health
curl http://localhost:3001/health

# Test frontend
open http://localhost:3000

# Test stakeholder API
curl http://localhost:3001/api/stakeholders

# Login credentials
# Email: admin@esopfable.com
# Password: SecureAdmin123!
```

---

## ⚠️ **SHUTDOWN PROCESS (Current Status)**

### **What Was Shut Down**
- ✅ **Backend API Server**: npm run dev process terminated (exit code 144)
- ✅ **Frontend React Server**: npm start process terminated  
- ✅ **PostgreSQL Container**: esopfable-postgres stopped
- ✅ **All Node.js Processes**: Development servers terminated

### **Shutdown Commands Used**
```bash
# Stop Node.js development servers
pkill -f "npm run dev"
pkill -f "npm start"

# Stop PostgreSQL container
docker stop esopfable-postgres
```

### **System State Verification**
- ✅ No running containers: `docker ps` shows empty
- ✅ No Node.js dev servers running
- ✅ Ports 3000 and 3001 are now free
- ✅ Database data preserved in Docker volume

---

## 📊 **System Components**

### **Services & Ports**
| Service | Port | Status | Command |
|---------|------|--------|---------|
| Frontend (React) | 3000 | 🔴 Stopped | `cd src/frontend && npm start` |
| Backend (Express) | 3001 | 🔴 Stopped | `cd backend && npm run dev` |
| PostgreSQL | 5432 | 🔴 Stopped | `docker start esopfable-postgres` |

### **Data Persistence**
- ✅ **Database**: Data preserved in Docker volume
- ✅ **Code Changes**: All committed to git repository
- ✅ **Configuration**: Environment files intact
- ✅ **Dependencies**: node_modules preserved

---

## 🔍 **Troubleshooting**

### **If Startup Fails**

**Database Connection Issues**
```bash
# Check if PostgreSQL container exists
docker ps -a | grep esopfable-postgres

# Restart container if needed
docker start esopfable-postgres

# Check container logs
docker logs esopfable-postgres
```

**Port Conflicts**
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Kill conflicting processes
kill -9 <PID>
```

**Node.js Issues**
```bash
# Clear npm cache
cd backend && npm cache clean --force
cd ../src/frontend && npm cache clean --force

# Reinstall dependencies if needed
rm -rf node_modules package-lock.json
npm install
```

### **If Data is Missing**
```bash
# Run database migrations
cd backend
npm run migrate

# Seed demo data
npm run seed
```

---

## 📋 **Pre-Startup Checklist**

- [ ] Navigate to correct directory: `/Users/user/Development/work/esopfable`
- [ ] Ensure Docker is running
- [ ] Check no conflicting processes on ports 3000, 3001, 5432
- [ ] Verify git repository is up to date
- [ ] Confirm environment files exist (`.env` in backend)

---

## 🎯 **Expected Results After Startup**

### **URLs to Test**
- **Main App**: http://localhost:3000 (Login portal)
- **Dashboard**: http://localhost:3000/dashboard (After login)
- **Stakeholders**: http://localhost:3000/stakeholders (Feature complete)
- **API Health**: http://localhost:3001/health
- **API Docs**: http://localhost:3001/api-docs

### **Demo Credentials**
- **Email**: `admin@esopfable.com`
- **Password**: `SecureAdmin123!`

### **Working Features**
- ✅ Professional login portal
- ✅ Dashboard navigation
- ✅ Complete stakeholder management system
- ✅ Category filtering (6 categories)
- ✅ Real-time search functionality
- ✅ Stakeholder detail modals
- ✅ Security level indicators
- ✅ Backend API with demo data

---

## 🔄 **Development Workflow**

### **Making Changes**
1. Start system with startup commands
2. Make code changes (hot reload active)
3. Test changes in browser
4. Commit changes with `git add` and `git commit`
5. Push to GitHub with `git push origin master`

### **Repository**
- **GitHub**: https://github.com/binarybcc/esopfable-stakeholder-system
- **Latest Commit**: Next session startup instructions added
- **Branch**: master (up to date)

---

## 📝 **Session Notes**

### **Last Session Achievements**
- ✅ Complete stakeholder management system implemented
- ✅ Professional UI with React 18 + TypeScript
- ✅ Backend API with Express.js + TypeScript
- ✅ PostgreSQL database with demo data
- ✅ Git repository properly configured
- ✅ GitHub integration working
- ✅ Docker-compose configuration fixed
- ✅ Next session audit instructions prepared

### **Next Session Priority**
1. **Context7 Research**: Get latest docs on tech stack
2. **Code Audit**: Comprehensive security and performance review
3. **Optimization**: Implement best practices improvements
4. **Feature Planning**: Next development priorities

---

**🎯 READY FOR NEXT SESSION: System cleanly shut down with complete startup instructions!**

*Created: September 1, 2025*