@echo off
echo ====================================================
echo   Starting WoundCare Mobile App (Expo)
echo ====================================================
cd mobile
if not exist "node_modules" (
    echo Installing mobile dependencies...
    call npm install
)
echo Starting Expo Development Server...
call npx expo start
pause
