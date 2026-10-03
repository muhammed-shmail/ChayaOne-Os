@echo off
setlocal EnableExtensions
title ChayaOne OS - Build Release Android APK
color 0A
cls

echo =================================================================
echo        CHAYAONE OS - WAITER ANDROID APK RELEASE BUILDER
echo =================================================================
echo.
echo [*] Target: Building ChayaOne Waiter App RELEASE APK (Staff Tablets)
echo [*] Mode: assembleRelease (Optimized + Signed)
echo.
echo Target Output: apps\waiter-android\release-apks\ChayaOne-Waiter-Release.apk
echo =================================================================
echo.

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
if not exist "%JAVA_HOME%\bin\java.exe" (
    echo [ERROR] Java runtime not found at: %JAVA_HOME%
    echo Please ensure Android Studio or OpenJDK 21 is installed.
    goto :error
)

set "PATH=%JAVA_HOME%\bin;%PATH%"

echo [*] Using Java Runtime: %JAVA_HOME%
echo.

:: Build Waiter Release APK
echo -----------------------------------------------------------------
echo Compiling ChayaOne Waiter App (Release Build)...
echo -----------------------------------------------------------------
cd /d "%~dp0apps\waiter-android"
call gradlew.bat assembleRelease
if %ERRORLEVEL% NEQ 0 goto :waiter_error

:: Copy to release-apks
cd /d "%~dp0"
if not exist "apps\waiter-android\release-apks" mkdir "apps\waiter-android\release-apks"

copy /y "apps\waiter-android\app\build\outputs\apk\release\app-release.apk" "apps\waiter-android\release-apks\ChayaOne-Waiter-Release.apk" >nul
copy /y "apps\waiter-android\app\build\outputs\apk\release\app-release.apk" "apps\waiter-android\release-apks\ChayaOne-Waiter.apk" >nul
copy /y "apps\waiter-android\app\build\outputs\apk\release\app-release.apk" "apps\pos-ui\public\downloads\ChayaOne-Waiter.apk" >nul
copy /y "apps\waiter-android\app\build\outputs\apk\release\app-release.apk" "apps\pos-ui\public\downloads\waiter.apk" >nul

echo.
echo =================================================================
echo [SUCCESS] ChayaOne Waiter Release APK built successfully!
echo.
echo Release APK file: apps\waiter-android\release-apks\ChayaOne-Waiter-Release.apk
echo.
echo Sideloading: Transfer this APK to any Android tablet/handheld
echo via USB cable, Google Drive, or WhatsApp, and tap to install.
echo =================================================================
echo.
goto :done

:waiter_error
echo.
echo [ERROR] Failed to compile ChayaOne Waiter Release APK.
goto :error

:error
echo.
echo Build process encountered an error.
echo.

:done
echo Press any key to close this window...
pause >nul
