@echo off
setlocal enabledelayedexpansion
title Clinic Management System - Explicit Upgrade
color 0B

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - EXPLICIT UPGRADE
echo   Source = this folder, Target = your installed app folder
echo ============================================================
echo.

set "SRC_DIR=%~dp0"
if "%SRC_DIR:~-1%"=="\" set "SRC_DIR=%SRC_DIR:~0,-1%"
set "SERVICE_NAME=ClinicManagementSystem"
set "SERVICE_DISPLAY_NAME=Clinic Management System"

if not defined INSTALL_DIR set /p INSTALL_DIR=Enter installed app folder path (example D:\clinic): 
set "INSTALL_DIR=%INSTALL_DIR:"=%"
if not defined INSTALL_DIR (
  echo ERROR: Target path is required.
  pause
  exit /b 1
)

for %%A in ("%SRC_DIR%") do set "SRC_ABS=%%~fA"
for %%A in ("%INSTALL_DIR%") do set "DST_ABS=%%~fA"
echo Source: %SRC_ABS%
echo Target: %DST_ABS%
echo.

if /I "%SRC_ABS%"=="%DST_ABS%" (
  echo ERROR: Source and target are same. Use a separate NEW code folder as source.
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%\server.js" (
  echo ERROR: server.js not found in target: %INSTALL_DIR%
  pause
  exit /b 1
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
set "BACKUP_DIR=%INSTALL_DIR%\upgrade-backups\pre-upgrade-%STAMP%"

echo [1/7] Backing up current data...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if exist "%INSTALL_DIR%\data" robocopy "%INSTALL_DIR%\data" "%BACKUP_DIR%\data" /E /R:1 /W:1 >nul
echo Backup: %BACKUP_DIR%
echo.

echo [2/7] Stopping running app...
where pm2 >nul 2>&1
if %errorlevel%==0 pm2 stop clinic >nul 2>&1
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel%==0 net stop "%SERVICE_DISPLAY_NAME%" >nul 2>&1
echo.

echo [3/7] Copying new code (preserving data)...
robocopy "%SRC_ABS%" "%DST_ABS%" /E /R:1 /W:1 /XD ".git" "node_modules" "data" /XF "install.bat" "uninstall.bat" "upgrade-preserve-data.bat" "upgrade-explicit-target.bat"
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo ERROR: Copy failed with robocopy code %RC%
  pause
  exit /b %RC%
)
echo Copy done. Robocopy code: %RC%
echo.

echo [4/7] Installing dependencies...
cd /d "%INSTALL_DIR%"
call npm install --omit=dev
if %errorlevel% neq 0 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)
call npm install node-windows --no-save
if %errorlevel% neq 0 (
  echo ERROR: Could not install node-windows.
  pause
  exit /b 1
)
echo Rebuilding native modules...
call npm rebuild
if %errorlevel% neq 0 (
  echo WARNING: npm rebuild had errors ^(may be harmless^).
)
echo.

echo [5/7] Re-registering service...
set "CLINIC_INSTALL_DIR=%INSTALL_DIR%"
set "CLINIC_SERVICE_NAME=%SERVICE_NAME%"
set "CLINIC_SERVICE_DESCRIPTION=Clinic Management System - Web Server on port 5000"
set "CLINIC_PORT=5000"
set "PORT=5000"
node "%INSTALL_DIR%\scripts\unregister-service.js" >nul 2>&1
timeout /t 2 >nul
node "%INSTALL_DIR%\scripts\register-service.js"
if %errorlevel% neq 0 (
  echo ERROR: Service re-registration failed.
  pause
  exit /b 1
)
echo.

echo [6/7] Running migration bootstrap...
node -e "require('./server'); setTimeout(()=>process.exit(0), 1200)" >nul 2>&1
echo.

echo [7/7] Starting app...
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel%==0 (
  net start "%SERVICE_DISPLAY_NAME%" >nul 2>&1
) else (
  start "Clinic App" cmd /c "cd /d %INSTALL_DIR% && npm start"
)
echo.

echo Verifying target has latest UI script reference...
findstr /C:"app.js?v=" "%INSTALL_DIR%\public\index.html"
echo.

echo ============================================================
echo   UPGRADE COMPLETE
echo   Hard refresh browser: Ctrl+Shift+R
echo ============================================================
pause
