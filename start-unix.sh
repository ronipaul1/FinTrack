#!/bin/bash
echo "============================================"
echo "  FinTrack Money Manager - Quick Start"
echo "============================================"
echo ""

echo "[1/3] Installing backend dependencies..."
cd backend && npm install
if [ $? -ne 0 ]; then
  echo "ERROR: Backend install failed"
  exit 1
fi

echo ""
echo "[2/3] Installing frontend dependencies..."
cd ../frontend && npm install
if [ $? -ne 0 ]; then
  echo "ERROR: Frontend install failed"
  exit 1
fi

echo ""
echo "[3/3] Starting servers..."
cd ..

echo ""
echo "============================================"
echo "  Backend  → http://localhost:5000"
echo "  Frontend → http://localhost:3000"
echo "============================================"
echo ""
echo "NOTE: Make sure MySQL is running!"
echo "Press Ctrl+C to stop all servers."
echo ""

# Start backend in background
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment then start frontend
sleep 2
cd ../frontend && npm start &
FRONTEND_PID=$!

# Open browser after delay
sleep 5
if command -v open &>/dev/null; then
  open http://localhost:3000    # macOS
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000  # Linux
fi

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID
