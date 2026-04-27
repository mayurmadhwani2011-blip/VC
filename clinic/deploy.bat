@echo off
title Clinic Deploy to Service
color 0A

echo ============================================================
echo   CLINIC - DEPLOY LATEST CODE TO PRODUCTION SERVICE
echo   Copies files and restarts the Windows service
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Run deploy.bat as Administrator.
    pause
    exit /b 1
)

set "SRC_DIR=%~dp0"
if "%SRC_DIR:~-1%"=="\" set "SRC_DIR=%SRC_DIR:~0,-1%"
set "INSTALL_DIR=D:\clinic"
set "SERVICE_NAME=ClinicManagementSystem"

if not exist "%INSTALL_DIR%" (
    echo ERROR: Install folder not found: %INSTALL_DIR%
    echo Run install.bat first.
    pause
    exit /b 1
)

echo [1/3] Stopping service...
net stop "%SERVICE_NAME%" >nul 2>&1
timeout /t 2 >nul

echo [2/3] Copying updated files to %INSTALL_DIR%...
robocopy "%SRC_DIR%" "%INSTALL_DIR%" server.js /R:1 /W:1 >nul
robocopy "%SRC_DIR%\public" "%INSTALL_DIR%\public" app.js style.css index.html /R:1 /W:1 >nul
robocopy "%SRC_DIR%\scripts" "%INSTALL_DIR%\scripts" /E /R:1 /W:1 >nul
robocopy "%SRC_DIR%" "%INSTALL_DIR%" package.json /R:1 /W:1 >nul
echo Files copied.

echo [3/3] Starting service...
net start "%SERVICE_NAME%" >nul 2>&1
timeout /t 3 >nul

:: Verify
sc query "%SERVICE_NAME%" | findstr /i "RUNNING" >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo ============================================================
    echo   DEPLOYED SUCCESSFULLY
    echo   Service is running at http://localhost:5000
    echo ============================================================
) else (
    echo.
    echo WARNING: Service may not have started. Check Services panel.
)
echo.
pause
