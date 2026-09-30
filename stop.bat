@echo off
echo Stopping WoundCare PM2 Services...
call pm2 stop ecosystem.config.js
call pm2 status
pause
