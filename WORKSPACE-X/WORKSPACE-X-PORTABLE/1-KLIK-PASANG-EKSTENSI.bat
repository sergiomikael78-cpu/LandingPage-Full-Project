@echo off
setlocal enabledelayedexpansion
title WORKSPACE-X • Pemasang Ekstensi Browser 1-Klik

:: Dapatkan path absolut folder extension
set "EXT_DIR=%~dp0extension"

:: Salin path ke Windows Clipboard via powershell/clip
powershell -NoProfile -Command "Set-Clipboard -Value '%EXT_DIR%'" >nul 2>&1
if %errorlevel% neq 0 (
    echo %EXT_DIR%| clip
)

cls
echo =======================================================================
echo               WORKSPACE-X • PEMASANG EKSTENSI BROWSER
echo =======================================================================
echo.
echo [OK] Alamat folder ekstensi telah OTOMATIS DISALIN ke Clipboard komputer!
echo      Path: "%EXT_DIR%"
echo.
echo -----------------------------------------------------------------------
echo LANGKAH CEPAT DI BROWSER (HANYA BUTUH 5 DETIK):
echo -----------------------------------------------------------------------
echo  1. Browser akan otomatis terbuka ke halaman Extensions / Ekstensi.
echo  2. Di pojok kanan atas, NYALAKAN toggle: "Developer mode" (Mode Pengembang).
echo  3. Klik tombol: "Load unpacked" (Muat yang belum dibongkar).
echo  4. Pada kotak dialog jendela Windows yang muncul:
echo     -^> Tekan kombinasi tombol: Ctrl + V di kotak nama folder
echo     -^> Klik tombol "Select Folder" (Pilih Folder).
echo  5. SELESAI! Ekstensi Workspace Hub Bridge langsung terhubung aktif!
echo -----------------------------------------------------------------------
echo.

:: Coba buka halaman ekstensi di browser yang terpasang
start "" "chrome://extensions" >nul 2>&1
start "" "opera://extensions" >nul 2>&1

echo Halaman extensions telah dibuka di browser Anda.
echo Anda dapat menutup jendela terminal ini kapan saja.
echo.
pause
exit /b 0
