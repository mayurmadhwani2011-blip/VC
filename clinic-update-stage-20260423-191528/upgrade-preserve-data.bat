@echo off
setlocal enabledelayedexpansion
title Clinic Management System - Safe Upgrade
color 0B

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - SAFE UPGRADE
echo   Preserves existing data and applies latest code changes
echo ============================================================
echo.

set "SRC_DIR=%~dp0"
if "%SRC_DIR:~-1%"=="\" set "SRC_DIR=%SRC_DIR:~0,-1%"
set "SERVICE_NAME=ClinicManagementSystem"
set "SERVICE_DISPLAY_NAME=Clinic Management System"
set "INSTALL_DIR="
set "BACKUP_ROOT=%INSTALL_DIR%\upgrade-backups"

echo Detecting install directory from Windows service...
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$svc = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue ^| Where-Object { $_.Name -eq 'ClinicManagementSystem' -or $_.DisplayName -eq 'Clinic Management System' -or $_.Name -like 'Clinic*Management*' } ^| Select-Object -First 1; if ($svc) { $raw = [string]$svc.PathName; if ($raw.StartsWith([char]34)) { $exe = ($raw -split [char]34)[1] } else { $exe = ($raw -split ' ')[0] }; $dir = Split-Path $exe -Parent; if (Test-Path (Join-Path $dir 'server.js')) { $dir } else { $found = Get-ChildItem -Path $dir -Filter server.js -Recurse -ErrorAction SilentlyContinue ^| Select-Object -First 1; if ($found) { Split-Path $found.FullName -Parent } } }"`) do set "INSTALL_DIR=%%i"
if not defined INSTALL_DIR if exist "C:\Program Files\ClinicManagement\server.js" set "INSTALL_DIR=C:\Program Files\ClinicManagement"
if not defined INSTALL_DIR if exist "D:\clinic\server.js" set "INSTALL_DIR=D:\clinic"
if not defined INSTALL_DIR if exist "C:\ClinicApp\server.js" set "INSTALL_DIR=C:\ClinicApp"
if not defined INSTALL_DIR if exist "C:\Program Files\ClinicApp\server.js" set "INSTALL_DIR=C:\Program Files\ClinicApp"
if not defined INSTALL_DIR (
  echo Auto-detect failed.
  set /p INSTALL_DIR=Enter install folder path (example C:\Program Files\ClinicManagement): 
)
set "INSTALL_DIR=%INSTALL_DIR:"=%"
if not defined INSTALL_DIR set "INSTALL_DIR=C:\ClinicApp"
set "BACKUP_ROOT=%INSTALL_DIR%\upgrade-backups"
echo Using install directory: %INSTALL_DIR%
for %%A in ("%SRC_DIR%") do set "SRC_ABS=%%~fA"
for %%A in ("%INSTALL_DIR%") do set "DST_ABS=%%~fA"
echo Upgrade source folder: %SRC_ABS%
echo Upgrade target folder: %DST_ABS%
if /I "%SRC_ABS%"=="%DST_ABS%" (
  echo.
  echo ERROR: Source and target folders are the same.
  echo Run this script from a separate folder that contains the NEW code,
  echo then target your installed app folder.
  echo Example:
  echo   Source: D:\clinic_new
  echo   Target: D:\clinic
  pause
  exit /b 1
)
echo.

if not exist "%INSTALL_DIR%\server.js" (
  echo ERROR: Existing install not found at %INSTALL_DIR%
  echo Please install once first, then run this upgrade script.
  pause
  exit /b 1
)

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
set "BACKUP_DIR=%BACKUP_ROOT%\pre-upgrade-%STAMP%"

echo [1/6] Creating safety backup...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if exist "%INSTALL_DIR%\data" (
  robocopy "%INSTALL_DIR%\data" "%BACKUP_DIR%\data" /E /R:1 /W:1 >nul
)
if exist "%INSTALL_DIR%\package.json" copy /Y "%INSTALL_DIR%\package.json" "%BACKUP_DIR%\package.json" >nul
echo Backup saved to: %BACKUP_DIR%
echo.

echo [2/6] Stopping running app (if any)...
where pm2 >nul 2>&1
if %errorlevel%==0 (
  pm2 stop clinic >nul 2>&1
)
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel%==0 (
  net stop "%SERVICE_DISPLAY_NAME%" >nul 2>&1
)
echo.

echo [3/6] Copying new code (preserving data folder)...
robocopy "%SRC_DIR%" "%INSTALL_DIR%" /E /R:1 /W:1 /XD ".git" "node_modules" "data" /XF "install.bat" "uninstall.bat" "upgrade-preserve-data.bat" >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo ERROR: File copy failed with robocopy exit code %RC%
  pause
  exit /b %RC%
)
echo.

echo [4/7] Installing/updating dependencies...
cd /d "%INSTALL_DIR%"
call npm install --omit=dev
if %errorlevel% neq 0 (
  echo ERROR: npm install failed.
  echo Your backup is safe at: %BACKUP_DIR%
  pause
  exit /b 1
)
call npm install node-windows --no-save
if %errorlevel% neq 0 (
  echo ERROR: Could not install node-windows.
  pause
  exit /b 1
)
echo.

echo [5/7] Re-registering Windows service...
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

echo [6/7] Running DB migration bootstrap...
node -e "require('./server'); setTimeout(()=>process.exit(0), 1200)" >nul 2>&1
echo.

echo [7/7] Starting app again...
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel%==0 (
  net start "%SERVICE_DISPLAY_NAME%" >nul 2>&1
) else (
  start "Clinic App" cmd /c "cd /d %INSTALL_DIR% && npm start"
)

echo ============================================================
echo   UPGRADE COMPLETE
echo   Data preserved. Backup: %BACKUP_DIR%
echo   Open: http://localhost:5000
echo ============================================================
echo.
pause
