@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Hay tai tai https://nodejs.org roi chay lai file nay. & pause & exit /b)
if not exist node_modules (call npm install --no-audit --no-fund)
node wft-crawler.mjs --browser
pause
