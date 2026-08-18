@echo off
TITLE ChayaOne OS — Local Main PC Runtime Engine
COLOR 0A
cls
echo =================================================================
echo                 CHAYAONE OS — MAIN PC LOCAL SERVER
echo =================================================================
echo [1/3] Probing embedded PostgreSQL database (port 5433)...
echo [2/3] Starting ChayaOne Web Platform, WebSocket, and Print Engine...
echo [3/3] Launching POS interface in your browser...
echo =================================================================
echo.

cd /d "%~dp0platform"
node scripts/launch-local-server.mjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] ChayaOne Server exited with an error code.
    pause
)
