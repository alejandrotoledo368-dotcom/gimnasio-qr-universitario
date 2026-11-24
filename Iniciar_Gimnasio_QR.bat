@echo off
setlocal
cd /d "%~dp0"
title UniSport - Gimnasio QR

if exist "GimnasioQR.exe" (
  start "UniSport" "%~dp0GimnasioQR.exe"
  exit /b 0
)

where python >nul 2>&1
if not errorlevel 1 (
  start "UniSport" python "%~dp0launcher.py"
  exit /b 0
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro GimnasioQR.exe, Python ni npm.
  echo Vuelve a descargar el proyecto completo.
  pause
  exit /b 1
)

if not exist "node_modules" call npm install
if errorlevel 1 (
  echo ERROR: No fue posible instalar las dependencias.
  pause
  exit /b 1
)

start "Abrir UniSport" powershell -NoProfile -WindowStyle Hidden -Command "$urls=@('http://localhost:3000/','http://localhost:3000/admin.html'); for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest -UseBasicParsing $urls[0] -TimeoutSec 1 ^| Out-Null; $urls ^| ForEach-Object {Start-Process $_}; exit}catch{Start-Sleep -Milliseconds 500}}"
call npm run dev

