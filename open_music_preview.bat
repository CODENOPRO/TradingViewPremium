@echo off
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  python "%~dp0preview_music.py" --open
) else (
  py -3 "%~dp0preview_music.py" --open
)
if errorlevel 1 pause
