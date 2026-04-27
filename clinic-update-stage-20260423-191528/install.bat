@echo off
setlocal enabledelayedexpansion
title Clinic Management System - Installer
color 0A

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - INSTALLER
echo   Fresh install or reinstall with data preservation
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run install.bat as Administrator.
    pause
    exit /b 1
)

set "SRC_DIR=%~dp0"
if "%SRC_DIR:~-1%"=="\" set "SRC_DIR=%SRC_DIR:~0,-1%"
set "DEFAULT_INSTALL_DIR=D:\clinic"
set "SERVICE_NAME=ClinicManagementSystem"
set "SERVICE_DISPLAY_NAME=Clinic Management System"
set "SERVICE_LABEL=Clinic Management System"
set "PORT=5000"

set /p INSTALL_DIR=Install folder [%DEFAULT_INSTALL_DIR%]: 
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
set "INSTALL_DIR=%INSTALL_DIR:"=%"
for %%A in ("%INSTALL_DIR%") do set "INSTALL_DIR=%%~fA"

echo.
echo Target install folder: %INSTALL_DIR%
echo Service: %SERVICE_DISPLAY_NAME%
echo Port: %PORT%
echo.

echo [1/8] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Install Node.js 18+ and run again.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo Node version: %%v
echo.

set "HAS_EXISTING_DATA=0"
if exist "%INSTALL_DIR%\data\clinic-data.json" set "HAS_EXISTING_DATA=1"

if "%HAS_EXISTING_DATA%"=="1" (
    echo [2/8] Backing up existing data...
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
    set "BACKUP_DIR=%INSTALL_DIR%\upgrade-backups\pre-install-!STAMP!"
    if not exist "!BACKUP_DIR!" mkdir "!BACKUP_DIR!"
    robocopy "%INSTALL_DIR%\data" "!BACKUP_DIR!\data" /E /R:1 /W:1 >nul
    echo Data backup: !BACKUP_DIR!
) else (
    echo [2/8] No existing data detected.
)
echo.

echo [3/8] Stopping previous app instance (if any)...
where pm2 >nul 2>&1
if %errorlevel%==0 pm2 stop clinic >nul 2>&1
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel%==0 net stop "%SERVICE_DISPLAY_NAME%" >nul 2>&1
echo.

echo [4/8] Copying application files...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if "%HAS_EXISTING_DATA%"=="1" (
    robocopy "%SRC_DIR%" "%INSTALL_DIR%" /E /R:1 /W:1 /XD ".git" "node_modules" "data" /XF "install.bat" "uninstall.bat" >nul
) else (
    robocopy "%SRC_DIR%" "%INSTALL_DIR%" /E /R:1 /W:1 /XD ".git" "node_modules" /XF "install.bat" "uninstall.bat" >nul
)
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
    echo ERROR: File copy failed with robocopy code %RC%.
    pause
    exit /b %RC%
)
echo File copy completed. Robocopy code: %RC%
echo.
echo Pulling latest app.js from GitHub to ensure correct API URL...
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/mayurmadhwani2011-blip/CMS/main/public/app.js' -OutFile '%INSTALL_DIR%\public\app.js' } catch { Write-Host 'Could not download latest app.js - using local copy' }"
echo.

echo [5/8] Installing dependencies...
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
echo Rebuilding native modules for Node v%NODE_VER%...
call npm rebuild
echo.

echo [6/8] Re-registering Windows service...
set "CLINIC_INSTALL_DIR=%INSTALL_DIR%"
set "CLINIC_SERVICE_NAME=%SERVICE_NAME%"
set "CLINIC_SERVICE_DESCRIPTION=Clinic Management System - Web Server on port %PORT%"
set "CLINIC_PORT=%PORT%"
set "PORT=%PORT%"
node "%INSTALL_DIR%\scripts\unregister-service.js" >nul 2>&1
timeout /t 2 >nul
node "%INSTALL_DIR%\scripts\register-service.js"
if %errorlevel% neq 0 (
    echo ERROR: Service registration failed.
    pause
    exit /b 1
)
echo.

echo [7/8] Configuring firewall and desktop shortcut...
netsh advfirewall firewall delete rule name="%SERVICE_LABEL%" >nul 2>&1
netsh advfirewall firewall add rule name="%SERVICE_LABEL%" dir=in action=allow protocol=TCP localport=%PORT% >nul
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut([Environment]::GetFolderPath('CommonDesktopDirectory') + '\\Clinic App.lnk'); $sc.TargetPath = 'http://127.0.0.1:%PORT%'; $sc.IconLocation = 'C:\\Windows\\System32\\shell32.dll,13'; $sc.Save()"
echo.

echo [8/8] Final checks...
net start "%SERVICE_DISPLAY_NAME%" >nul 2>&1
echo Waiting for app to start...
set "APP_READY=0"
for /l %%w in (1,1,6) do (
    timeout /t 3 >nul
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%' -TimeoutSec 5; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if !errorlevel!==0 (
        set "APP_READY=1"
        goto :app_ready
    )
    echo   Still waiting... (%%w/6)
)
:app_ready
if "!APP_READY!"=="0" (
    echo.
    set "LOG=%INSTALL_DIR%\startup-error.log"
    echo --- Service status --- > "!LOG!"
    sc query "%SERVICE_NAME%" >> "!LOG!" 2>&1
    echo. >> "!LOG!"
    echo --- node server.js output --- >> "!LOG!"
    cd /d "%INSTALL_DIR%"
    set PORT=%PORT%
    node server.js >> "!LOG!" 2>&1
    echo.
    echo ============================================================
    echo   App did not start. Error log saved to:
    echo   !LOG!
    echo.
    echo Opening log file...
    notepad "!LOG!"
    echo.
    echo After reading the log, open http://127.0.0.1:%PORT% manually.
    echo If needed, fix the error then run: net start "%SERVICE_DISPLAY_NAME%"
    pause
)

echo.
echo ============================================================
echo   INSTALLATION COMPLETE
echo   App URL: http://127.0.0.1:%PORT%
echo   Install folder: %INSTALL_DIR%
echo ============================================================
echo.
pause
