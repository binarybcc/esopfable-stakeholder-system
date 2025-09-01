# 📋 Next Session Startup Instructions

## 🔍 **PRIORITY: Code Audit with Context7**

### **Required Action for Next Session**
Use Context7 to get up-to-date documentation on our technology stack before conducting a comprehensive code audit.

### **Technology Stack to Research**
1. **React 18 + TypeScript** - Component patterns, hooks, best practices
2. **Express.js + TypeScript** - API design, middleware, security
3. **Node.js** - Latest LTS features, performance optimizations
4. **PostgreSQL** - Schema design, security, performance
5. **Socket.IO** - Real-time communication patterns
6. **Docker & Docker Compose** - Container best practices
7. **JWT Authentication** - Security implementation standards

### **Context7 Commands to Run**
```bash
# Get latest React 18 + TypeScript documentation
Use context7 to resolve library ID for "React 18"
Get library docs focusing on "hooks, TypeScript, components"

# Get Express.js + TypeScript best practices
Use context7 to resolve library ID for "Express.js TypeScript"
Get library docs focusing on "API design, security, middleware"

# Get PostgreSQL schema design patterns
Use context7 to resolve library ID for "PostgreSQL"
Get library docs focusing on "schema design, security"

# Get Socket.IO real-time patterns
Use context7 to resolve library ID for "Socket.IO"
Get library docs focusing on "real-time, authentication"
```

### **Code Audit Focus Areas**

#### **Security Review**
- [ ] Authentication implementation (JWT, sessions)
- [ ] Input validation and sanitization
- [ ] CORS configuration
- [ ] Rate limiting effectiveness
- [ ] SQL injection prevention
- [ ] XSS protection measures

#### **Performance Analysis**
- [ ] React component optimization (memo, callbacks)
- [ ] Database query efficiency
- [ ] API endpoint response times
- [ ] Bundle size optimization
- [ ] Memory usage patterns

#### **Code Quality Assessment**
- [ ] TypeScript usage and type safety
- [ ] Component architecture and reusability  
- [ ] Error handling patterns
- [ ] Code organization and modularity
- [ ] Documentation completeness

#### **Best Practices Compliance**
- [ ] React 18 concurrent features usage
- [ ] Express.js middleware patterns
- [ ] Database schema normalization
- [ ] Docker optimization
- [ ] Git workflow adherence

### **Current Implementation Status**
- ✅ **Stakeholder Management System**: Complete and functional
- ✅ **Authentication Portal**: Working with demo credentials
- ✅ **Backend API**: REST endpoints with TypeScript
- ✅ **Database**: PostgreSQL with comprehensive schema
- ✅ **Frontend**: React 18 with TypeScript components
- ✅ **Git/GitHub**: Repository properly configured

### **Specific Files to Audit**
1. `/src/frontend/src/components/stakeholders/StakeholderDashboard.tsx` - Main React component
2. `/backend/src/server.ts` - Express.js server configuration
3. `/src/frontend/src/index.tsx` - React app entry point and routing
4. `/backend/migrations/20241201000003_create_stakeholders_table.js` - Database schema
5. `docker-compose.yml` - Container configuration

### **Expected Outcomes**
- **Security Recommendations**: Based on latest best practices
- **Performance Improvements**: Specific optimizations to implement
- **Code Refactoring**: Areas for improvement with latest patterns
- **Documentation Updates**: Missing or outdated documentation
- **Future Feature Planning**: Next development priorities

### **Session Timeline**
1. **Context7 Research** (15 minutes) - Get latest docs
2. **Code Audit** (30 minutes) - Systematic review
3. **Recommendations** (15 minutes) - Document findings
4. **Priority Planning** (10 minutes) - Next development steps

---

**🎯 This audit will ensure our ESOPFable system follows current best practices and is ready for production deployment or further feature development.**

*Created: September 1, 2025*
*Repository: https://github.com/binarybcc/esopfable-stakeholder-system*