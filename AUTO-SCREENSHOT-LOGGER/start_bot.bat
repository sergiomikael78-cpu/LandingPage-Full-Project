@echo off
echo Starting LATOTO PC Ultra Modern Version...
echo.

REM Cek apakah python sudah ada
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python tidak ditemukan. Mengunduh dan menginstall Python...
    echo [==========          ] Downloading Python...
    powershell -Command "Invoke-WebRequest -Uri https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe -OutFile python-installer.exe"
    echo [====================] Download selesai.
    echo [#####               ] Installing Python...
    start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    echo [####################] Install selesai.
    del python-installer.exe
)

REM Cek ulang python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo =====================================================
    echo  GAGAL: Python tidak berhasil diinstall otomatis!
    echo  Silakan install manual dari https://python.org
    echo  Saat install, CENTANG "Add Python to PATH".
    echo  Setelah selesai, restart komputer atau terminal.
    echo =====================================================
    pause
    exit /b
)

REM Cek apakah pip sudah ada
where pip >nul 2>nul
if %errorlevel% neq 0 (
    echo pip tidak ditemukan. Mencoba install pip...
    python -m ensurepip --upgrade
)

REM Upgrade pip ke versi terbaru
python -m pip install --upgrade pip

REM Install semua requirements
python -m pip install -r requirements.txt

REM Jalankan aplikasi tanpa terminal
pythonw main.py

echo Aplikasi sudah dijalankan. Tekan tombol apapun untuk keluar.
pause 