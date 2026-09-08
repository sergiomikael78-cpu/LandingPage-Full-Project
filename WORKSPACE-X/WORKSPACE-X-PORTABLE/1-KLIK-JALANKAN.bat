@echo off
setlocal enabledelayedexpansion
title Menjalankan WORKSPACE-X Portable...

echo =======================================================================
echo                 WORKSPACE-X (PORTABLE EDITION)
echo       Aplikasi Otomasi Workspace ^& Tab Browser untuk Shift Kerja
echo =======================================================================
echo.

:: Pastikan folder data lokal ada untuk mode portable
if not exist "%~dp0data" (
    mkdir "%~dp0data" >nul 2>&1
)

:: Periksa apakah WebView2 Runtime tersedia (Bawaan Windows 10/11)
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>&1
if %errorlevel% neq 0 (
    reg query "HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >nul 2>&1
    if %errorlevel% neq 0 (
        echo [INFO] Memeriksa komponen Microsoft WebView2...
    )
)

echo [OK] Menjalankan WORKSPACE-X secara instan tanpa instalasi apapun...
echo.

start "" "%~dp0Workspace-Hub.exe"
exit /b 0
