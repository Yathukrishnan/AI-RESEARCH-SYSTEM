@echo off
title ARIS Frontend – Port 3000
color 0E
cd /d "%~dp0"

echo ============================================
echo   ARIS Frontend  –  http://localhost:3000
echo ============================================

echo Installing dependencies if needed...
if not exist "node_modules" (
    echo [npm] Running npm install...
    npm install
)

echo.
echo Starting Vite dev server...
echo.

npm run dev

pause
