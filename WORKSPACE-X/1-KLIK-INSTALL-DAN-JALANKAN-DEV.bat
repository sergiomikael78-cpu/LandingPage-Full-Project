@echo off
setlocal enabledelayedexpansion
title WORKSPACE-X - Setup Otomatis & Jalankan Project

echo =======================================================================
echo          WORKSPACE-X - SETUP OTOMATIS & JALANKAN PROJECT
echo =======================================================================
echo.
echo [1/4] Memeriksa Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [PERINGATAN] Node.js belum terinstall di komputer ini!
    echo Mencoba menginstall Node.js otomatis via Windows Package Manager (winget)...
    winget install OpenJS.NodeJS -e --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] Gagal menginstall Node.js secara otomatis.
        echo TIPS: Anda bisa langsung menggunakan "1-KLIK-JALANKAN-PORTABLE.bat"
        echo       atau "Workspace-Hub-Setup.exe" yang TIDAK MEMERLUKAN Node.js sama sekali!
        echo.
        pause
        exit /b 1
    )
    echo Silakan tutup jendela ini dan jalankan kembali script ini setelah installasi selesai.
    pause
    exit /b 0
) else (
    for /f "tokens=*" %%v in ('node -v') do echo     -> Node.js terdeteksi: %%v
)

echo.
echo [2/4] Memeriksa dependensi project (node_modules)...
if not exist "%~dp0node_modules\" (
    echo     -> Menginstall dependencies (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install gagal.
        pause
        exit /b 1
    )
) else (
    echo     -> node_modules sudah siap.
)

echo.
echo [3/4] Melakukan build ekstensi browser (Service Worker)...
call npm run build:ext
if %errorlevel% neq 0 (
    echo [ERROR] Build ekstensi gagal.
    pause
    exit /b 1
)

echo.
echo [4/4] Memeriksa Rust & Cargo...
where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Rust/Cargo tidak terdeteksi di terminal ini.
    echo Menjalankan dalam mode Web Dev Server (Vite)...
    echo.
    call npm run dev
) else (
    echo     -> Rust terdeteksi. Menjalankan Desktop App via Tauri IPC...
    call npm run tauri dev
)

exit /b 0
