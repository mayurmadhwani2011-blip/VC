@echo off
setlocal enabledelayedexpansion
title Clinic Management - Online Update
color 0B

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - ONLINE UPDATE
echo   Downloads latest code from GitHub and upgrades in place
echo ============================================================
echo.

:: Check admin elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Please right-click this file and choose "Run as Administrator".
  echo.
  pause
  exit /b 1
)

:: Set defaults (pre-filled, user can override)
if not defined CLINIC_GITHUB_OWNER set "CLINIC_GITHUB_OWNER=mayurmadhwani2011-blip"
if not defined CLINIC_GITHUB_REPO  set "CLINIC_GITHUB_REPO=CMS"
if not defined CLINIC_GITHUB_BRANCH set "CLINIC_GITHUB_BRANCH=main"
if not defined INSTALL_DIR set "INSTALL_DIR=D:\clinic"

echo Defaults loaded:
echo   Repo  : %CLINIC_GITHUB_OWNER%/%CLINIC_GITHUB_REPO% branch=%CLINIC_GITHUB_BRANCH%
echo   Target: %INSTALL_DIR%
echo.

:: Always prompt for token so the window stays open and user sees something
echo GitHub Personal Access Token is required for a private repo.
echo (If you already saved it before, press Enter to keep the saved value.)
echo.
set "TOKEN_PROMPT=Enter GitHub token (or press Enter to use saved): "
if defined CLINIC_GITHUB_TOKEN set "TOKEN_PROMPT=Enter GitHub token [saved, press Enter to keep]: "
set /p "NEW_TOKEN=%TOKEN_PROMPT%"
if defined NEW_TOKEN set "CLINIC_GITHUB_TOKEN=%NEW_TOKEN%"

if not defined CLINIC_GITHUB_TOKEN (
  echo.
  echo WARNING: No token entered. Download will fail for private repos.
  echo Press Ctrl+C to cancel, or any key to try anyway...
  pause >nul
)

set "TMP_ROOT=%TEMP%\clinic-online-update-%RANDOM%%RANDOM%"
set "ZIP_FILE=%TMP_ROOT%\clinic.zip"
mkdir "%TMP_ROOT%" >nul 2>&1

echo [1/4] Downloading latest package...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $url='https://api.github.com/repos/'+$env:CLINIC_GITHUB_OWNER+'/'+$env:CLINIC_GITHUB_REPO+'/zipball/'+$env:CLINIC_GITHUB_BRANCH; $headers=@{ 'User-Agent'='ClinicOnlineUpdater'; 'Accept'='application/vnd.github+json' }; if($env:CLINIC_GITHUB_TOKEN){ $headers['Authorization']='Bearer '+$env:CLINIC_GITHUB_TOKEN }; Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers -OutFile $env:ZIP_FILE"
if %errorlevel% neq 0 (
  echo ERROR: Download failed. Check internet, repo name, branch, and token.
  pause
  exit /b 1
)

echo [2/4] Extracting package...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path $env:ZIP_FILE -DestinationPath $env:TMP_ROOT -Force"
if %errorlevel% neq 0 (
  echo ERROR: Could not extract downloaded package.
  pause
  exit /b 1
)

set "EXTRACTED="
for /d %%D in ("%TMP_ROOT%\*") do if not defined EXTRACTED set "EXTRACTED=%%~fD"
if not defined EXTRACTED (
  echo ERROR: Could not find extracted folder.
  pause
  exit /b 1
)

set "SRC_DIR=%EXTRACTED%"
if exist "%EXTRACTED%\clinic\upgrade-explicit-target.bat" set "SRC_DIR=%EXTRACTED%\clinic"
if not exist "%SRC_DIR%\upgrade-explicit-target.bat" (
  echo ERROR: upgrade-explicit-target.bat not found in downloaded package.
  pause
  exit /b 1
)

echo [3/4] Saving updater settings...
setx CLINIC_GITHUB_OWNER "%CLINIC_GITHUB_OWNER%" /M >nul
setx CLINIC_GITHUB_REPO "%CLINIC_GITHUB_REPO%" /M >nul
setx CLINIC_GITHUB_BRANCH "%CLINIC_GITHUB_BRANCH%" /M >nul
if defined CLINIC_GITHUB_TOKEN setx CLINIC_GITHUB_TOKEN "%CLINIC_GITHUB_TOKEN%" /M >nul

echo [4/4] Running explicit upgrade...
pushd "%SRC_DIR%"
call upgrade-explicit-target.bat
set "RC=%ERRORLEVEL%"
popd

if %RC% neq 0 (
  echo.
  echo Upgrade finished with errors. Review the output above.
  pause
  exit /b %RC%
)

echo.
echo Online update completed successfully.
echo Hard refresh browser with Ctrl+Shift+R.
echo.
pause
exit /b 0

