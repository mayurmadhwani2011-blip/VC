@echo off
setlocal enabledelayedexpansion
title Clinic Management - Online Install
color 0A

echo ============================================================
echo   CLINIC MANAGEMENT SYSTEM - ONLINE INSTALL
echo   Downloads latest code from GitHub and runs installer
echo ============================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Run this script as Administrator.
  pause
  exit /b 1
)

if not defined CLINIC_GITHUB_OWNER set "CLINIC_GITHUB_OWNER=mayurmadhwani2011-blip"
if not defined CLINIC_GITHUB_REPO set "CLINIC_GITHUB_REPO=CMS"
if not defined CLINIC_GITHUB_BRANCH set "CLINIC_GITHUB_BRANCH=main"
if not defined INSTALL_DIR set "INSTALL_DIR=D:\clinic"

echo Install target: %INSTALL_DIR%
echo Repo: %CLINIC_GITHUB_OWNER%/%CLINIC_GITHUB_REPO% (%CLINIC_GITHUB_BRANCH%)
echo.

if not defined CLINIC_GITHUB_TOKEN (
  set /p CLINIC_GITHUB_TOKEN=GitHub token for private repo (leave blank for public repo): 
)

set "TMP_ROOT=%TEMP%\clinic-online-install-%RANDOM%%RANDOM%"
set "ZIP_FILE=%TMP_ROOT%\clinic.zip"
mkdir "%TMP_ROOT%" >nul 2>&1

echo [1/4] Downloading latest package...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $url='https://api.github.com/repos/'+$env:CLINIC_GITHUB_OWNER+'/'+$env:CLINIC_GITHUB_REPO+'/zipball/'+$env:CLINIC_GITHUB_BRANCH; $headers=@{ 'User-Agent'='ClinicOnlineInstaller'; 'Accept'='application/vnd.github+json' }; if($env:CLINIC_GITHUB_TOKEN){ $headers['Authorization']='Bearer '+$env:CLINIC_GITHUB_TOKEN }; Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers -OutFile $env:ZIP_FILE"
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
if exist "%EXTRACTED%\clinic\install.bat" set "SRC_DIR=%EXTRACTED%\clinic"
if not exist "%SRC_DIR%\install.bat" (
  echo ERROR: install.bat not found in downloaded package.
  pause
  exit /b 1
)

echo [3/4] Saving updater settings...
setx CLINIC_GITHUB_OWNER "%CLINIC_GITHUB_OWNER%" /M >nul
setx CLINIC_GITHUB_REPO "%CLINIC_GITHUB_REPO%" /M >nul
setx CLINIC_GITHUB_BRANCH "%CLINIC_GITHUB_BRANCH%" /M >nul
if defined CLINIC_GITHUB_TOKEN setx CLINIC_GITHUB_TOKEN "%CLINIC_GITHUB_TOKEN%" /M >nul

echo [4/4] Running installer...
pushd "%SRC_DIR%"
call install.bat
set "RC=%ERRORLEVEL%"
popd

if %RC% neq 0 (
  echo.
  echo Installer finished with errors. Review the output above.
  pause
  exit /b %RC%
)

echo.
echo Online install completed successfully.
echo.
pause
exit /b 0

