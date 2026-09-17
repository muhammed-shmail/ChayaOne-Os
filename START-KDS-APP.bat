@echo off
setlocal EnableExtensions
title ChayaOne OS - Kitchen Display System (KDS)
color 0C
cls

echo =================================================================
echo             CHAYAONE OS - KITCHEN DISPLAY STATION (KDS)
echo =================================================================
echo [1] Launching Kitchen Display System in Desktop App Window...
echo [2] Real-time KOT tickets, prep timers, station routing, and bumps
echo.
echo NOTE: Ensure the Main PC Server (START-MAIN-PC.bat) is running.
echo =================================================================
echo.

set "CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_X86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "EDGE_BIN=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE_64=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME_BIN%" (
    start "" "%CHROME_BIN%" --app="http://localhost:3000/kds" --window-size=1280,800 --new-window
    goto :done
)
if exist "%EDGE_BIN%" (
    start "" "%EDGE_BIN%" --app="http://localhost:3000/kds" --window-size=1280,800 --new-window
    goto :done
)
if exist "%CHROME_X86%" (
    start "" "%CHROME_X86%" --app="http://localhost:3000/kds" --window-size=1280,800 --new-window
    goto :done
)
if exist "%EDGE_64%" (
    start "" "%EDGE_64%" --app="http://localhost:3000/kds" --window-size=1280,800 --new-window
    goto :done
)

start http://localhost:3000/kds

:done
exit /b 0
