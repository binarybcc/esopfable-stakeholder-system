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
