@echo off
setlocal
cd /d "%~dp0"
title Trading Terminal
set "TERMINAL_PYTHON=python"
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "TERMINAL_PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
"%TERMINAL_PYTHON%" -c "import websockets" >nul 2>&1
if errorlevel 1 (
  echo Install dependencies first: python -m pip install -r requirements.txt
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\launch_tv.ps1"
if errorlevel 1 (
  pause
  exit /b 1
)
"%TERMINAL_PYTHON%" -c "import json,urllib.request; h=json.load(urllib.request.urlopen('http://127.0.0.1:3000/health',timeout=2)); raise SystemExit(not (h.get('ws_port')==8080 and h.get('service')=='trading-terminal' and h.get('protocol_version')==2))" >nul 2>&1
if not errorlevel 1 goto ready
powershell -NoProfile -Command "$client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1',3000); exit 0 } catch { exit 1 } finally { $client.Dispose() }"
if not errorlevel 1 (
  echo Port 3000 is occupied by another or older server. Close that server before starting this version.
  pause
  exit /b 1
)
rem Run the backend without a console and keep diagnostics in backend\backend.log.
"%TERMINAL_PYTHON%" -c "import subprocess, sys; log = open('backend/backend.log', 'ab'); subprocess.Popen([sys.executable, 'backend/bridge_server.py'], stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW); log.close()"
if errorlevel 1 goto backend_failed
for /l %%i in (1,1,8) do (
  "%TERMINAL_PYTHON%" -c "import json,urllib.request; h=json.load(urllib.request.urlopen('http://127.0.0.1:3000/health',timeout=1)); raise SystemExit(h.get('service')!='trading-terminal')" >nul 2>&1
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)
:backend_failed
echo Backend did not start. See backend\backend.log for details.
pause
exit /b 1
:ready
start "" "http://localhost:3000"
echo Terminal: http://localhost:3000
endlocal
