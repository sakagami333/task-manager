@echo off
setlocal

set "BASE=%~dp0"
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"

echo [1/3] Installing backend dependencies...
cd /d "%BASE%backend"
call npm install --prefer-offline
if errorlevel 1 (
    echo Backend install failed. Check the error above.
    pause
    exit /b 1
)
echo.

echo [2/3] Building frontend...
cd /d "%BASE%frontend"
call npm run build
if errorlevel 1 (
    echo Build failed. Check the error above.
    pause
    exit /b 1
)
echo Build complete.
echo.

echo [3/3] Starting server (http://localhost:3001)...
start "TaskManager" cmd /k "cd /d "%BASE%backend" && set NODE_ENV=production && node src/server.js"
timeout /t 3 /nobreak > nul
start "" http://localhost:3001
