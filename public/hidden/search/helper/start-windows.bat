@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Hay tai tai https://nodejs.org roi chay lai file nay. & pause & exit /b)
node wft-crawler.mjs
pause
