@echo off
setlocal
cd /d "%~dp0"
title Trading Terminal
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
set "TERMINAL_PYTHON=python"
"%TERMINAL_PYTHON%" -c "import websockets, tzdata" >nul 2>&1
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "TERMINAL_PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)
"%TERMINAL_PYTHON%" -c "import websockets, tzdata" >nul 2>&1
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
powershell -NoProfile -Command "$ports=@(3000,8080); foreach($p in $ports){ $c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1',$p); Write-Host ('Port '+$p+' occupied'); exit 0 } catch {} finally { $c.Dispose() } }; exit 1"
if not errorlevel 1 (
  echo Port 3000 or 8080 is occupied by another server. Close that server before starting this version.
  pause
  exit /b 1
)
rem Run the backend without a console and keep UTF-8 diagnostics in backend\backend.log.
"%TERMINAL_PYTHON%" -c "import os, subprocess, sys; env = dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8'); log = open('backend/backend.log', 'ab'); subprocess.Popen([sys.executable, 'backend/bridge_server.py'], stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, env=env, creationflags=subprocess.CREATE_NO_WINDOW); log.close()"
if errorlevel 1 goto backend_failed
for /l %%i in (1,1,10) do (
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
