@echo off
cd /d "%~dp0"
node scripts/local-service.mjs stop
pause
