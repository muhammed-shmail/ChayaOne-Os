@echo off
setlocal EnableExtensions
title ChayaOne OS - Install APK to Android Device
color 0B
cls

echo =================================================================
echo        CHAYAONE OS - ANDROID APK DEVICE INSTALLER (ADB)
echo =================================================================
echo.

set "ADB_EXE=C:\Users\nmsss\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB_EXE%" (
    where adb >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "ADB_EXE=adb"
    ) else (
        echo [ERROR] Android ADB tool was not found.
        echo Please ensure Android SDK platform-tools is installed.
        goto :done
    )
)

echo [*] Checking connected Android devices...
echo.
"%ADB_EXE%" devices
echo.

echo [1] Install ChayaOne Waiter App to device
echo [2] Exit
echo.
set /p "CHOICE=Enter choice [1-2]: "

if "%CHOICE%"=="1" goto :install_waiter
goto :done

:install_waiter
echo.
echo [*] Installing ChayaOne-Waiter.apk to device...
"%ADB_EXE%" install -r -d "%~dp0android\release-apks\ChayaOne-Waiter.apk"
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] ChayaOne Waiter App installed successfully!
) else (
    echo [FAILED] Installation failed. Ensure USB debugging is enabled on your device.
)
goto :done

:done
echo.
echo Press any key to close this window...
pause >nul
