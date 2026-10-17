@echo off
cd /d "%~dp0"
call npm.cmd run build
if errorlevel 1 goto finish
node scripts/local-service.mjs start
:finish
pause
