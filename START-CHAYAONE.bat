@echo off
title Starting ChayaOne OS...
if exist "%LOCALAPPDATA%\Programs\@cafeosdesktop\ChayaOne App.exe" (
    start "" "%LOCALAPPDATA%\Programs\@cafeosdesktop\ChayaOne App.exe" --route=/pos
    exit /b 0
)
if exist "%~dp0local-first\platform\apps\desktop\dist-installers-v6\win-unpacked\ChayaOne App.exe" (
    start "" "%~dp0local-first\platform\apps\desktop\dist-installers-v6\win-unpacked\ChayaOne App.exe" --route=/pos
    exit /b 0
)
echo ChayaOne App executable was not found.
pause
