@echo off
setlocal EnableExtensions
title ChayaOne OS - Build Waiter Android APK
color 0A
cls

echo =================================================================
echo             CHAYAONE OS - WAITER ANDROID APK BUILDER
echo =================================================================
echo.
echo [*] Target: Building ChayaOne Waiter App APK (Staff Tablets)
echo [*] Customer App: Uses PWA via Table QR code (no APK needed)
echo.
echo Target Output Folder: android\release-apks\
echo =================================================================
echo.

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not exist "%JAVA_HOME%\bin\java.exe" (
    echo [ERROR] Java runtime not found at: %JAVA_HOME%
    echo Please ensure Android Studio or OpenJDK 21 is installed.
    goto :error
)

echo [*] Using Java Runtime: %JAVA_HOME%
echo.

:: Build Waiter APK
echo -----------------------------------------------------------------
echo Compiling ChayaOne Waiter App (com.chayaone.waiter)...
echo -----------------------------------------------------------------
cd /d "%~dp0local-first\platform\apps\waiter-android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 goto :waiter_error

:: Copy to release-apks
cd /d "%~dp0"
if not exist "android\release-apks" mkdir "android\release-apks"

copy /y "local-first\platform\apps\waiter-android\app\build\outputs\apk\debug\app-debug.apk" "android\release-apks\ChayaOne-Waiter.apk" >nul
copy /y "local-first\platform\apps\waiter-android\app\build\outputs\apk\debug\app-debug.apk" "local-first\platform\apps\web\public\downloads\ChayaOne-Waiter.apk" >nul
copy /y "local-first\platform\apps\waiter-android\app\build\outputs\apk\debug\app-debug.apk" "local-first\platform\apps\web\public\downloads\waiter.apk" >nul

echo.
echo =================================================================
echo [SUCCESS] ChayaOne Waiter Android APK built successfully!
echo.
echo Output file: android\release-apks\ChayaOne-Waiter.apk
echo.
echo You can transfer this APK to any Android tablet or handheld
echo via USB cable or run INSTALL-APK-TO-DEVICE.bat
echo =================================================================
echo.
goto :done

:waiter_error
echo.
echo [ERROR] Failed to compile ChayaOne Waiter App APK.
goto :error

:error
echo.
echo Build process encountered an error.
echo.

:done
echo Press any key to close this window...
pause >nul
