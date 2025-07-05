#!/bin/bash

# Start RSS-Tok Development Environment
# This script starts both backend and frontend in development mode

echo "🚀 Starting RSS-Tok Development Environment"

# Check if backend dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Check if frontend exists and install dependencies
if [ -d "../RSS-Tok-Front" ]; then
    echo "📦 Checking frontend dependencies..."
    cd ../RSS-Tok-Front
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    cd ../RSS-Tok
else
    echo "⚠️  Frontend not found at ../RSS-Tok-Front"
    echo "   Please ensure the frontend is in the correct location"
fi

# Start backend in background
echo "🔧 Starting backend server..."
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend if it exists
if [ -d "../RSS-Tok-Front" ]; then
    echo "🎨 Starting frontend server..."
    cd ../RSS-Tok-Front
    npm run dev &
    FRONTEND_PID=$!
    cd ../RSS-Tok
    
    echo ""
    echo "✅ Both servers are starting..."
    echo "📊 Backend API: http://localhost:3000"
    echo "📊 Backend Dashboard: http://localhost:3000/dashboard"
    echo "🎨 Frontend: http://localhost:5173"
    echo ""
    echo "Press Ctrl+C to stop both servers"
    
    # Wait for Ctrl+C
    trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
    wait
else
    echo ""
    echo "✅ Backend server started"
    echo "📊 API: http://localhost:3000"
    echo "📊 Dashboard: http://localhost:3000/dashboard"
    echo ""
    echo "Press Ctrl+C to stop the server"
    
    # Wait for Ctrl+C
    trap "echo '🛑 Stopping server...'; kill $BACKEND_PID 2>/dev/null; exit" INT
    wait $BACKEND_PID
fi