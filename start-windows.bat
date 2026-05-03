@echo off
echo ============================================
echo   FinTrack Money Manager - Quick Start
echo ============================================
echo.

echo [1/3] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend install failed. Try: npm install --legacy-peer-deps
    pause
    exit /b 1
)

echo.
echo [2/3] Installing frontend dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend install failed. Try: npm install --legacy-peer-deps
    pause
    exit /b 1
)

echo.
echo [3/3] Starting servers...
cd ..
echo.
echo ============================================
echo   Starting Backend on http://localhost:5000
echo   Starting Frontend on http://localhost:3000
echo ============================================
echo.
echo NOTE: Make sure XAMPP MySQL is running!
echo Press Ctrl+C to stop servers.
echo.

start "FinTrack Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak > nul
start "FinTrack Frontend" cmd /k "cd frontend && npm start"

echo Both servers started. Opening browser...
timeout /t 5 /nobreak > nul
start http://localhost:3000
