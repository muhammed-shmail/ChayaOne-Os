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
copy /y "local-first\platform\apps\desktop\dist-installers-v6\ChayaOne App Setup 0.1.0.exe" "release-main-pc\ChayaOne-MainPC-Setup.exe" >nul

echo.
echo =================================================================
echo [SUCCESS] ChayaOne Main PC Desktop Installer built successfully!
echo.
echo Installer file: release-main-pc\ChayaOne-MainPC-Setup.exe
echo.
echo Double-click ChayaOne-MainPC-Setup.exe to install and run the
echo ChayaOne Main PC Desktop Application on any Windows 10/11 PC.
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
