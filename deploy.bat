@echo off
echo ====================================================
echo   WoundCare Windows VPS Deployment Script
echo   Port: 3367
echo ====================================================

:: Ensure Node and Python are available
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Python310;C:\Program Files\Python311"

echo.
echo [1/4] Preparing Python Backend Virtual Environment...
cd backend
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo Installing/updating backend dependencies...
pip install -r requirements.txt
cd ..

echo.
echo [2/4] Installing Frontend Dependencies...
cd frontend
call npm install
echo.
echo [3/4] Building Frontend for Production...
call npm run build
cd ..

echo.
echo [4/4] Starting / Reloading PM2 Processes...
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo PM2 not found globally. Installing PM2 globally...
    call npm install -g pm2
)

call pm2 startOrReload ecosystem.config.js
call pm2 save
echo.
echo ====================================================
echo   Deployment Complete!
echo   Application is running on: http://localhost:3367
echo ====================================================
call pm2 status
pause
