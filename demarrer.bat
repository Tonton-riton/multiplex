@echo off
title Multiplex Live Overlay
echo ========================================================
echo         LANCEMENT DU SERVEUR MULTIPLEX LIVE
echo ========================================================
echo.

cd /d "%~dp0"

echo Verification des dependances...
if not exist "node_modules" (
    echo Installation initiale des modules npm...
    call npm install
)

echo.
echo Lancement du serveur sur http://localhost:3000 ...
start "" "http://localhost:3000/admin"

node server.js
pause
