@echo off
setlocal EnableExtensions
title ChayaOne OS - Build Main PC Desktop Application (.exe Installer)
color 0B
cls

echo =================================================================
echo     CHAYAONE OS - MAIN PC DESKTOP APP RELEASE BUILDER (.EXE)
echo =================================================================
echo.
echo [*] Target: Building ChayaOne Main PC Desktop Application
echo [*] Output: Standalone Windows NSIS Setup Installer (.exe)
echo [*] Destination: release-main-pc\ChayaOne-MainPC-Setup.exe
echo =================================================================
echo.

cd /d "%~dp0local-first\platform"

echo [*] Compiling Desktop Application TypeScript...
call npm run -w @cafeos/desktop build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to compile Desktop Application TypeScript.
    goto :error
)

echo.
echo [*] Packaging Windows Desktop Installer (.exe) with Electron Builder...
call npm run -w @cafeos/desktop build:installer
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to package desktop installer.
    goto :error
)

:: Copy to release-main-pc folder in root
cd /d "%~dp0"
if not exist "release-main-pc" mkdir "release-main-pc"
for %%F in ("local-first\platform\apps\desktop\dist-installers-v6\ChayaOne App Setup *.exe") do (
    copy /y "%%F" "release-main-pc\ChayaOne-MainPC-Setup.exe" >nul
)
if exist "local-first\platform\apps\desktop\dist-installers-v6\latest.yml" (
    copy /y "local-first\platform\apps\desktop\dist-installers-v6\latest.yml" "release-main-pc\latest.yml" >nul
)

echo.
echo =================================================================
echo [SUCCESS] ChayaOne Main PC Desktop Installer built successfully!
echo.
echo Installer file: release-main-pc\ChayaOne-MainPC-Setup.exe
echo Update manifest: release-main-pc\latest.yml
echo.
echo Double-click ChayaOne-MainPC-Setup.exe to install locally.
echo To publish an online update, upload both files to GitHub Releases!
echo =================================================================
echo.
goto :done

:error
echo.
echo [ERROR] Main PC Desktop Build failed.
echo.

:done
echo Press any key to close this window...
pause >nul
