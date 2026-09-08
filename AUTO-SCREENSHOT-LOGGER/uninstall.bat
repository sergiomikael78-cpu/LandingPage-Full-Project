@echo off
title LATOTO PC Uninstaller
color 0C

echo ========================================
echo    LATOTO PC Uninstaller
echo ========================================
echo.

echo Are you sure you want to uninstall LATOTO PC?
echo This will remove:
echo - Configuration file (config.json)
echo - Log file (latotopc.log)
echo - Startup shortcut
echo - All application data
echo.

set /p confirm="Type 'yes' to confirm uninstall: "

if /i "%confirm%"=="yes" (
    echo.
    echo Uninstalling LATOTO PC...
    
    :: Stop any running processes
    taskkill /f /im python.exe /fi "WINDOWTITLE eq LATOTO PC*" >nul 2>&1
    taskkill /f /im pythonw.exe /fi "WINDOWTITLE eq LATOTO PC*" >nul 2>&1
    
    :: Remove startup shortcut
    if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LATOTO PC.lnk" (
        del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LATOTO PC.lnk"
        echo Removed startup shortcut
    )
    
    :: Remove config file
    if exist "config.json" (
        del "config.json"
        echo Removed configuration file
    )
    
    :: Remove log file
    if exist "latotopc.log" (
        del "latotopc.log"
        echo Removed log file
    )
    
    echo.
    echo LATOTO PC has been uninstalled successfully!
    echo.
    echo Note: The application files (latotopc.py, start.bat, uninstall.bat) 
    echo are still in this folder. You can delete them manually if needed.
    echo.
    
) else (
    echo.
    echo Uninstall cancelled.
)

pause 