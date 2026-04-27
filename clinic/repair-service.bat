@echo off
setlocal enabledelayedexpansion
title Clinic Management - Service Repair
color 0E

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - SERVICE REPAIR
echo ============================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Run this script as Administrator.
  pause
  exit /b 1
)

if not defined INSTALL_DIR set "INSTALL_DIR=D:\clinic"
set "SERVICE_NAME=ClinicManagementSystem"
set "SERVICE_DISPLAY_NAME=Clinic Management System"
set "PORT=5000"

if not exist "%INSTALL_DIR%\server.js" (
  echo ERROR: server.js not found at %INSTALL_DIR%
  echo Set INSTALL_DIR first if your app is in a different folder.
  echo Example: set INSTALL_DIR=D:\myclinic
  pause
  exit /b 1
)

echo Repair target: %INSTALL_DIR%
echo.

echo [1/6] Stopping existing service/process...
where pm2 >nul 2>&1
if %errorlevel%==0 pm2 stop clinic >nul 2>&1
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorlevel%==0 net stop "%SERVICE_DISPLAY_NAME%" >nul 2>&1
echo.

echo [2/6] Reinstalling dependencies...
cd /d "%INSTALL_DIR%"
call npm install --omit=dev
if %errorlevel% neq 0 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)
call npm install node-windows --no-save
if %errorlevel% neq 0 (
  echo ERROR: npm install node-windows failed.
  pause
  exit /b 1
)
call npm rebuild
echo.

echo [3/6] Re-registering Windows service...
set "CLINIC_INSTALL_DIR=%INSTALL_DIR%"
set "CLINIC_SERVICE_NAME=%SERVICE_NAME%"
set "CLINIC_SERVICE_DESCRIPTION=Clinic Management System - Web Server on port %PORT%"
set "CLINIC_PORT=%PORT%"
set "PORT=%PORT%"
if defined CLINIC_GITHUB_OWNER set "CLINIC_GITHUB_OWNER=%CLINIC_GITHUB_OWNER%"
if defined CLINIC_GITHUB_REPO set "CLINIC_GITHUB_REPO=%CLINIC_GITHUB_REPO%"
if defined CLINIC_GITHUB_TOKEN set "CLINIC_GITHUB_TOKEN=%CLINIC_GITHUB_TOKEN%"
node "%INSTALL_DIR%\scripts\unregister-service.js" >nul 2>&1
timeout /t 2 >nul
node "%INSTALL_DIR%\scripts\register-service.js"
if %errorlevel% neq 0 (
  echo ERROR: Service registration failed.
  pause
  exit /b 1
)
echo.

echo [4/6] Starting service...
net start "%SERVICE_DISPLAY_NAME%" >nul 2>&1

echo [5/6] Waiting for startup...
timeout /t 8 >nul

echo [6/6] Health check...
powershell -NoProfile -Command "$ok=$false; foreach($p in @('%PORT%','5050')){ try { Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:'+ $p +'/api/me') -TimeoutSec 8 | Out-Null; Write-Host ('Healthy on port '+$p); $ok=$true; break } catch { $msg=$_.Exception.Message; if($msg -and $msg -match 'Not logged in|401|403'){ Write-Host ('Healthy on port '+$p+' (auth expected)'); $ok=$true; break } } }; if($ok){ exit 0 } else { exit 1 }"
if %errorlevel% neq 0 (
  echo.
  echo Service started but app endpoint is not healthy yet.
  echo Collecting diagnostics in %INSTALL_DIR%\startup-error.log
  powershell -NoProfile -Command "$log='%INSTALL_DIR%\\startup-error.log'; Remove-Item $log -ErrorAction SilentlyContinue; '=== Service query ===' | Out-File $log -Encoding UTF8; sc.exe query '%SERVICE_NAME%' | Out-File $log -Append -Encoding UTF8; '=== Listening ports (5000/5050) ===' | Out-File $log -Append -Encoding UTF8; netstat -ano | findstr /R /C:":5000" /C:":5050" | Out-File $log -Append -Encoding UTF8; '=== Direct startup probe ===' | Out-File $log -Append -Encoding UTF8; $psi = New-Object System.Diagnostics.ProcessStartInfo; $psi.FileName='cmd.exe'; $psi.Arguments='/c cd /d "%INSTALL_DIR%" ^& set PORT=5000 ^& node server.js'; $psi.UseShellExecute=$false; $psi.RedirectStandardOutput=$true; $psi.RedirectStandardError=$true; $p = New-Object System.Diagnostics.Process; $p.StartInfo=$psi; [void]$p.Start(); Start-Sleep -Seconds 7; if(-not $p.HasExited){ 'node server.js stayed running for 7s (likely healthy when run directly).' | Out-File $log -Append -Encoding UTF8; try { $p.Kill() } catch {}; } else { 'node server.js exited early.' | Out-File $log -Append -Encoding UTF8; }; $out=$p.StandardOutput.ReadToEnd(); $err=$p.StandardError.ReadToEnd(); if($out){ '--- stdout ---' | Out-File $log -Append -Encoding UTF8; $out | Out-File $log -Append -Encoding UTF8 }; if($err){ '--- stderr ---' | Out-File $log -Append -Encoding UTF8; $err | Out-File $log -Append -Encoding UTF8 }"
  echo Attempting fallback run mode (without Windows service)...
  start "Clinic Fallback" /min cmd /c "cd /d %INSTALL_DIR% && set PORT=5000 && node server.js > \"%INSTALL_DIR%\fallback-server.log\" 2>&1"
  timeout /t 5 >nul
  powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/api/me' -TimeoutSec 8 | Out-Null; exit 0 } catch { exit 1 }"
  if %errorlevel%==0 (
    echo.
    echo Fallback mode is running. You can login now at http://127.0.0.1:%PORT%
    echo Windows service still needs fixing, but app is available.
    echo Fallback log: %INSTALL_DIR%\fallback-server.log
    pause
    exit /b 0
  )
  notepad "%INSTALL_DIR%\startup-error.log"
  pause
  exit /b 1
)

echo.
echo Service repaired successfully.
echo Open: http://127.0.0.1:%PORT%
echo.
pause
exit /b 0
