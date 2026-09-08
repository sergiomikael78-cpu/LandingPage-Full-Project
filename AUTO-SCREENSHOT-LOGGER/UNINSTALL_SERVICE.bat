@echo off
title SMJ Lab — Stop Auto Screenshot Service
cd /d "%~dp0"

echo =======================================================
echo     MENGHENTIKAN AUTO SCREENSHOT SERVICE
echo =======================================================
echo.

echo [*] Menghentikan semua proses background pythonw...
taskkill /f /im pythonw.exe >nul 2>nul

echo stopped > service_status.txt

echo [+] Service berhasil dihentikan.
echo.
pause
