@echo off
title ARIS Backend – Port 8001
color 0B
cd /d "%~dp0"

echo ============================================
echo   ARIS Backend  –  http://127.0.0.1:8001
echo ============================================

:: Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo [venv] Virtual environment activated.
) else (
    echo [warn] No venv found – using system Python.
)

echo.
echo Starting uvicorn on 127.0.0.1:8001 ...
echo.

python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

pause
