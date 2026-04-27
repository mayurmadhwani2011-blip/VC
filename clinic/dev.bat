@echo off
title Clinic Dev Server
color 0B

echo ============================================================
echo   CLINIC - DEV MODE
echo   Auto-restarts when server.js / app.js / style.css change
echo   URL: http://localhost:5050
echo   Press Ctrl+C to stop
echo ============================================================
echo.

:: Stop the Windows service so it doesn't conflict on port 5050
sc query ClinicManagementSystem >nul 2>&1
if %errorlevel%==0 (
    sc query ClinicManagementSystem | findstr /i "RUNNING" >nul 2>&1
    if %errorlevel%==0 (
        echo Stopping Windows service to free port 5050...
        net stop ClinicManagementSystem >nul 2>&1
        timeout /t 2 >nul
        echo Service stopped.
        echo.
    )
)

:: Kill any stale node process on port 5050
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5050 " ^| findstr "LISTENING"') do (
    echo Killing stale process on port 5050 (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

cd /d "%~dp0"

:: Check nodemon is installed
where nodemon >nul 2>&1
if %errorlevel% neq 0 (
    echo nodemon not found, installing...
    call npm install nodemon --save-dev
)

echo Starting dev server with auto-reload...
echo.
npx nodemon server.js --watch server.js --watch public/app.js --watch public/style.css --ext js,json,css
