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
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\launch_tv.ps1" -ForceRestart
if errorlevel 1 (
  echo [WARN] TradingView Desktop CDP 9222 not ready yet; starting web terminal anyway.
)
rem Reuse backend ONLY when both root directory and code build fingerprint match; otherwise replace stale bridge_server.py.
"%TERMINAL_PYTHON%" -c "import hashlib,json,os,pathlib,urllib.request; hh=hashlib.sha1(); [hh.update(pathlib.Path(p).read_bytes()) for p in ('backend/bridge_server.py','frontend/index.html') if pathlib.Path(p).exists()]; b=hh.hexdigest()[:12]; r=os.path.normcase(os.path.abspath('.')); h=json.load(urllib.request.urlopen('http://127.0.0.1:3000/health',timeout=2)); same=(h.get('ws_port')==8080 and h.get('service')=='trading-terminal' and h.get('protocol_version')==2 and os.path.normcase(str(h.get('root','')))==r and h.get('build')==b); raise SystemExit(0 if same else (2 if h.get('service')=='trading-terminal' else 1))" >nul 2>&1
set "HEALTH_RC=%errorlevel%"
if "%HEALTH_RC%"=="0" goto ready
powershell -NoProfile -Command "$stale = ('%HEALTH_RC%' -eq '2'); $conns = @(Get-NetTCPConnection -LocalPort 3000,8080 -State Listen -ErrorAction SilentlyContinue); foreach($c in $conns){ $pidId = $c.OwningProcess; if(-not $pidId){ continue }; $proc = Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidId) -ErrorAction SilentlyContinue; if($stale -or ($proc -and $proc.CommandLine -like '*bridge_server.py*')){ Write-Host ('[INFO] Stopping stale Trading Terminal server (PID '+$pidId+')...'); Stop-Process -Id $pidId -Force -ErrorAction SilentlyContinue } }; Start-Sleep -Milliseconds 600; foreach($p in @(3000,8080)){ $tc = New-Object System.Net.Sockets.TcpClient; try { $tc.Connect('127.0.0.1',$p); Write-Host ('Port '+$p+' is occupied by another server. Close that server before starting this version.'); exit 1 } catch {} finally { $tc.Dispose() } }; exit 0"
if errorlevel 1 (
  pause
  exit /b 1
)
rem Run the backend without a console and keep UTF-8 diagnostics in backend\backend.log.
"%TERMINAL_PYTHON%" -c "import os, subprocess, sys; env = dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8'); log = open('backend/backend.log', 'ab'); subprocess.Popen([sys.executable, 'backend/bridge_server.py'], stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, env=env, creationflags=subprocess.CREATE_NO_WINDOW); log.close()"
if errorlevel 1 goto backend_failed
for /l %%i in (1,1,10) do (
  "%TERMINAL_PYTHON%" -c "import json,os,urllib.request; h=json.load(urllib.request.urlopen('http://127.0.0.1:3000/health',timeout=1)); raise SystemExit(not (h.get('service')=='trading-terminal' and os.path.normcase(str(h.get('root','')))==os.path.normcase(os.path.abspath('.'))))" >nul 2>&1
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
