@echo off
title WORKSPACE-X - Buat Paket Portable & Installer
echo =======================================================================
echo          WORKSPACE-X - BUILD PRODUCTION & BUAT PAKET PORTABLE
echo =======================================================================
echo.
echo [1/3] Melakukan kompilasi Tauri production...
call npx tauri build
if %errorlevel% neq 0 (
    echo [ERROR] Build gagal.
    pause
    exit /b 1
)

echo.
echo [2/3] Mengupdate file installer "Workspace-Hub-Setup.exe"...
copy /y "%~dp0src-tauri\target\release\bundle\nsis\Workspace-Hub_1.0.0_x64-setup.exe" "%~dp0Workspace-Hub-Setup.exe"

echo.
echo [3/4] Mengupdate folder "WORKSPACE-X-PORTABLE"...
if not exist "%~dp0WORKSPACE-X-PORTABLE\" mkdir "%~dp0WORKSPACE-X-PORTABLE"
copy /y "%~dp0src-tauri\target\release\workspace_hub.exe" "%~dp0WORKSPACE-X-PORTABLE\Workspace-Hub.exe"
xcopy /e /i /y "%~dp0extension" "%~dp0WORKSPACE-X-PORTABLE\extension"

echo.
echo [4/4] Mengupdate arsip unduhan Landing Page (WORKSPACE-X.zip)...
tar -a -c -f "%~dp0..\WORKSPACE-X.zip" -C "%~dp0" WORKSPACE-X-PORTABLE

echo.
echo =======================================================================
echo BERHASIL! Seluruh paket dan Landing Page sudah siap:
echo 1. Portable Folder:  %~dp0WORKSPACE-X-PORTABLE\
echo 2. Landing Page ZIP: %~dp0..\WORKSPACE-X.zip (~3.7 MB)
echo =======================================================================
echo.
pause
