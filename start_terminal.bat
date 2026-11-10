@echo off
setlocal
cd /d "%~dp0"
title Trading Terminal
python -c "import websockets" >nul 2>&1
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
powershell -NoProfile -Command "try { $health = Invoke-RestMethod http://localhost:3000/health -TimeoutSec 2; if ($health.ws_port -eq 8080) { exit 0 }; exit 1 } catch { exit 1 }"
if not errorlevel 1 goto ready
powershell -NoProfile -Command "$client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1',3000); exit 0 } catch { exit 1 } finally { $client.Dispose() }"
if not errorlevel 1 (
  echo Port 3000 is occupied by another or older server. Close that server before starting this version.
  pause
  exit /b 1
)
start /b python "%~dp0backend\bridge_server.py"
for /l %%i in (1,1,8) do (
  powershell -NoProfile -Command "try { Invoke-RestMethod http://localhost:3000/health -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)
echo Backend did not start. Check the error above.
pause
exit /b 1
:ready
start "" "http://localhost:3000"
echo Terminal: http://localhost:3000
endlocal
