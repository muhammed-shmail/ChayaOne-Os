@echo off
setlocal EnableExtensions
title ChayaOne OS - Install APK to Android Device
color 0B
cls

echo =================================================================
echo        CHAYAONE OS - WAITER APP APK INSTALLER
echo =================================================================
echo.
echo [*] APK File:
echo     %~dp0android\release-apks\ChayaOne-Waiter-Release.apk
echo.
echo How to install on your Tablet:
echo  1. Connect tablet to PC with USB (Select 'File Transfer / MTP')
echo  2. Copy 'ChayaOne-Waiter-Release.apk' to your tablet's Downloads folder
echo  3. On tablet: Open 'Files' app -> Tap the APK -> Install
echo.
echo =================================================================
echo [1] Open APK folder in Windows Explorer (Recommended)
echo [2] Attempt ADB install (Advanced: Requires USB Debugging enabled)
echo [3] Exit
echo =================================================================
echo.
set /p "CHOICE=Enter choice [1-3]: "

if "%CHOICE%"=="1" goto :open_folder
if "%CHOICE%"=="2" goto :adb_install
goto :done

:open_folder
echo.
echo [*] Opening APK folder...
explorer.exe "%~dp0android\release-apks"
goto :done

:adb_install
set "ADB_EXE=C:\Users\nmsss\AppData\Local\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB_EXE%" (
    where adb >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "ADB_EXE=adb"
    ) else (
        echo [ERROR] Android ADB tool was not found.
        goto :done
    )
)
echo.
echo [*] Installing via ADB...
"%ADB_EXE%" install -r -d "%~dp0android\release-apks\ChayaOne-Waiter-Release.apk"
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] ChayaOne Waiter App installed successfully!
) else (
    echo [FAILED] No device detected or USB debugging is not enabled.
    echo Please use Option [1] to copy the APK file directly to your tablet.
)
goto :done

:done
echo.
echo Press any key to close this window...
pause >nul
