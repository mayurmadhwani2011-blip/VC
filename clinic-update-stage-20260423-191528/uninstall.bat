@echo off
setlocal enabledelayedexpansion
title Clinic Management System - Uninstaller
color 0C

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run as Administrator.
    pause
    exit /b 1
)

set "SERVICE_NAME=ClinicManagementSystem"
set "SERVICE_DISPLAY_NAME=Clinic Management System"
set "INSTALL_DIR="

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - UNINSTALLER
echo ============================================================
echo.

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$svc = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue ^| Where-Object { $_.Name -eq 'ClinicManagementSystem' -or $_.DisplayName -eq 'Clinic Management System' } ^| Select-Object -First 1; if ($svc) { $raw = [string]$svc.PathName; if ($raw.StartsWith([char]34)) { $exe = ($raw -split [char]34)[1] } else { $exe = ($raw -split ' ')[0] }; $dir = Split-Path $exe -Parent; if (Test-Path (Join-Path $dir 'server.js')) { $dir } else { $found = Get-ChildItem -Path $dir -Filter server.js -Recurse -ErrorAction SilentlyContinue ^| Select-Object -First 1; if ($found) { Split-Path $found.FullName -Parent } } }"`) do set "INSTALL_DIR=%%i"
if not defined INSTALL_DIR set "INSTALL_DIR=D:\clinic"
set "INSTALL_DIR=%INSTALL_DIR:"=%"

echo Detected app folder: %INSTALL_DIR%
echo.
echo Choose uninstall mode:
echo   1. Remove service only (keep app files and data)
echo   2. Remove service + app files (keep data)
echo   3. Full remove (service + app files + data)
set /p MODE=Enter option [1/2/3]: 
if "%MODE%"=="" set "MODE=1"
if not "%MODE%"=="1" if not "%MODE%"=="2" if not "%MODE%"=="3" (
    echo Invalid option.
    pause
    exit /b 1
)

set /p CONFIRM=Type YES to continue: 
if /i not "%CONFIRM%"=="YES" (
    echo Cancelled.
    pause
    exit /b 0
)

if exist "%INSTALL_DIR%\data\clinic-data.json" (
    for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
    set "BACKUP_DIR=%INSTALL_DIR%\upgrade-backups\pre-uninstall-%STAMP%"
    echo Creating data backup at %BACKUP_DIR% ...
    if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
    robocopy "%INSTALL_DIR%\data" "%BACKUP_DIR%\data" /E /R:1 /W:1 >nul
)

echo Stopping running app...
where pm2 >nul 2>&1
if %errorlevel%==0 pm2 stop clinic >nul 2>&1
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel%==0 net stop "%SERVICE_DISPLAY_NAME%" >nul 2>&1

echo Removing Windows service...
if exist "%INSTALL_DIR%\scripts\unregister-service.js" (
    set "CLINIC_INSTALL_DIR=%INSTALL_DIR%"
    set "CLINIC_SERVICE_NAME=%SERVICE_NAME%"
    node "%INSTALL_DIR%\scripts\unregister-service.js" >nul 2>&1
) else (
    sc stop "%SERVICE_NAME%" >nul 2>&1
    sc delete "%SERVICE_NAME%" >nul 2>&1
)

echo Removing firewall and shortcut...
netsh advfirewall firewall delete rule name="Clinic Management System" >nul 2>&1
del /f /q "%PUBLIC%\Desktop\Clinic App.lnk" >nul 2>&1

if "%MODE%"=="2" (
    echo Removing app files but preserving data...
    if exist "%INSTALL_DIR%" (
        for /d %%D in ("%INSTALL_DIR%\*") do (
            if /I not "%%~nxD"=="data" if /I not "%%~nxD"=="upgrade-backups" rd /s /q "%%D"
        )
        del /f /q "%INSTALL_DIR%\*" >nul 2>&1
    )
)

if "%MODE%"=="3" (
    echo Removing full application folder including data...
    if exist "%INSTALL_DIR%" rd /s /q "%INSTALL_DIR%"
)

echo.
echo ============================================================
if "%MODE%"=="1" echo   Uninstall complete: service removed, files/data preserved.
if "%MODE%"=="2" echo   Uninstall complete: service removed, app files removed, data preserved.
if "%MODE%"=="3" echo   Uninstall complete: full removal completed.
echo ============================================================
pause
