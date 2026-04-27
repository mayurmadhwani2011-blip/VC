@echo off
setlocal enabledelayedexpansion
title Clinic - Safe Update
color 0B

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - SAFE UPDATE
echo   Downloads latest code, stops service, applies, restarts
echo ============================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Please right-click and Run as Administrator.
  pause & exit /b 1
)

if not defined CLINIC_GITHUB_OWNER set "CLINIC_GITHUB_OWNER=mayurmadhwani2011-blip"
if not defined CLINIC_GITHUB_REPO  set "CLINIC_GITHUB_REPO=CMS"
if not defined CLINIC_GITHUB_BRANCH set "CLINIC_GITHUB_BRANCH=main"
if not defined INSTALL_DIR set "INSTALL_DIR=D:\clinic"

echo Repo  : %CLINIC_GITHUB_OWNER%/%CLINIC_GITHUB_REPO% (%CLINIC_GITHUB_BRANCH%)
echo Target: %INSTALL_DIR%
echo.

set "TOKEN_PROMPT=Enter GitHub token [saved, press Enter to keep]: "
if not defined CLINIC_GITHUB_TOKEN set "TOKEN_PROMPT=Enter GitHub token: "
set /p "NEW_TOKEN=%TOKEN_PROMPT%"
if defined NEW_TOKEN set "CLINIC_GITHUB_TOKEN=%NEW_TOKEN%"
if not defined CLINIC_GITHUB_TOKEN (
  echo ERROR: Token required for private repo.
  pause & exit /b 1
)

set "TMP_ROOT=%TEMP%\clinic-safe-update-%RANDOM%%RANDOM%"
set "ZIP_FILE=%TMP_ROOT%\clinic.zip"
set "EXTRACT_DIR=%TMP_ROOT%\extract"
mkdir "%TMP_ROOT%" "%EXTRACT_DIR%" >nul 2>&1

echo [1/6] Downloading latest package...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$h=@{'User-Agent'='ClinicSafeUpdate';'Accept'='application/vnd.github+json';'Authorization'='Bearer '+$env:CLINIC_GITHUB_TOKEN}; Invoke-WebRequest -UseBasicParsing -Uri ('https://api.github.com/repos/'+$env:CLINIC_GITHUB_OWNER+'/'+$env:CLINIC_GITHUB_REPO+'/zipball/'+$env:CLINIC_GITHUB_BRANCH) -Headers $h -OutFile $env:ZIP_FILE"
if %errorlevel% neq 0 (
  echo ERROR: Download failed. Check token and internet.
  pause & exit /b 1
)
echo Done.

echo [2/6] Extracting...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path $env:ZIP_FILE -DestinationPath $env:EXTRACT_DIR -Force"
if %errorlevel% neq 0 (
  echo ERROR: Extraction failed.
  pause & exit /b 1
)

set "SRC_DIR="
for /d %%D in ("%EXTRACT_DIR%\*") do if not defined SRC_DIR set "SRC_DIR=%%~fD"
if exist "%SRC_DIR%\clinic\server.js" set "SRC_DIR=%SRC_DIR%\clinic"
if not exist "%SRC_DIR%\server.js" (
  echo ERROR: server.js not found in downloaded package.
  pause & exit /b 1
)
echo Source: %SRC_DIR%

echo [3/6] Stopping service...
sc stop "ClinicManagementSystem" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

echo [4/6] Copying new files (data and node_modules preserved)...
robocopy "%SRC_DIR%" "%INSTALL_DIR%" /E /R:1 /W:1 ^
  /XD "%SRC_DIR%\node_modules" "%SRC_DIR%\.git" "%SRC_DIR%\data" ^
       "%INSTALL_DIR%\node_modules" "%INSTALL_DIR%\.git" "%INSTALL_DIR%\data" ^
  /XF "install.bat" "uninstall.bat" "upgrade-preserve-data.bat" "upgrade-explicit-target.bat" "safe-update.bat"
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo ERROR: File copy failed with robocopy code %RC%
  pause & exit /b %RC%
)
echo Copy done ^(robocopy code %RC% is OK^).

echo [5/6] Installing/rebuilding dependencies...
cd /d "%INSTALL_DIR%"
npm.cmd install --omit=dev
if %errorlevel% neq 0 (
  echo ERROR: npm install failed.
  pause & exit /b 1
)
npm.cmd rebuild better-sqlite3
echo Done.

echo [6/6] Starting service...
node "%INSTALL_DIR%\scripts\unregister-service.js" >nul 2>&1
node "%INSTALL_DIR%\scripts\register-service.js"
timeout /t 3 >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r=Invoke-WebRequest 'http://localhost:5000/index.html' -UseBasicParsing -TimeoutSec 10; if($r.StatusCode -eq 200 -and $r.Content.Length -gt 0){Write-Host 'HEALTH OK port 5000'}else{Write-Host 'HEALTH FAIL'} } catch { try { $r2=Invoke-WebRequest 'http://localhost:5050/index.html' -UseBasicParsing -TimeoutSec 10; if($r2.StatusCode -eq 200 -and $r2.Content.Length -gt 0){Write-Host 'HEALTH OK port 5050'}else{Write-Host 'HEALTH FAIL'} } catch { Write-Host 'HEALTH FAIL - service not responding' } }"

:: Save token for next time
setx CLINIC_GITHUB_TOKEN "%CLINIC_GITHUB_TOKEN%" /M >nul
setx CLINIC_GITHUB_OWNER "%CLINIC_GITHUB_OWNER%" /M >nul
setx CLINIC_GITHUB_REPO "%CLINIC_GITHUB_REPO%" /M >nul
setx CLINIC_GITHUB_BRANCH "%CLINIC_GITHUB_BRANCH%" /M >nul

:: Cleanup
rd /s /q "%TMP_ROOT%" >nul 2>&1

echo.
echo ============================================================
echo   UPDATE COMPLETE - Hard refresh browser: Ctrl+Shift+R
echo ============================================================
pause

