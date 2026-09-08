@echo off
title SMJ Lab — Auto Screenshot Logger Launcher
cd /d "%~dp0"

echo =======================================================
echo     SMJ LAB — AUTO SCREENSHOT & DISCORD LOGGER
echo =======================================================
echo.

REM 1. Cek apakah Python terdeteksi di PATH
where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo [!] Python belum terpasang di sistem.
        if exist "python-3.13.2-amd64.exe" (
            echo [*] Menginstall Python secara otomatis dari installer lokal...
            echo [*] Mohon tunggu beberapa saat...
            start /wait python-3.13.2-amd64.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
            echo [+] Instalasi Python selesai.
        ) else (
            echo [X] GAGAL: File installer Python tidak ditemukan.
            echo     Silakan install Python manual dan centang "Add Python to PATH".
            pause
            exit /b
        )
    )
)

REM 2. Cek apakah setup dependensi sudah pernah dilakukan
if not exist ".setup_done" (
    echo [*] Menyiapkan dependensi aplikasi untuk pertama kali...
    python -m pip install -r requirements.txt
    if %errorlevel% equ 0 (
        echo. > ".setup_done"
        echo [+] Setup dependensi selesai!
    ) else (
        echo [!] Terjadi kendala saat install dependensi, mencoba tetap menjalankan...
    )
)

REM 3. Jalankan aplikasi tanpa jendela command prompt (Background GUI)
echo [*] Meluncurkan aplikasi Auto Screenshot...
start "" pythonw main.py

echo [+] Aplikasi berhasil dibuka!
timeout /t 2 >nul
exit
