@echo off
title AI Research Intelligence System
color 0A

echo ============================================
echo   AI Research Intelligence System
echo ============================================
echo.

:: Kill any stale process on port 8001
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8001 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Start Backend in new window
echo [1/2] Starting Backend (port 8001)...
start "ARIS Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat 2>nul || echo [No venv found – using system Python] && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"

:: Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Frontend in new window
echo [2/2] Starting Frontend (port 3000)...
start "ARIS Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ============================================
echo   Both services are starting:
echo   Backend  →  http://127.0.0.1:8001
echo   Frontend →  http://localhost:3000
echo   API Docs →  http://127.0.0.1:8001/api/docs
echo ============================================
echo.
echo   Close this window or press any key to exit.
pause >nul
