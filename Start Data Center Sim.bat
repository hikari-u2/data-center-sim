@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo PowerShell was not found on this computer.
  echo You can still open index.html directly in a browser.
  pause
  exit /b 1
)

rem Launch the server in its own console window so Ctrl+C stops it cleanly
rem (avoids the cmd.exe "Terminate batch job (Y/N)?" prompt).
start "Data Center Sim" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-local.ps1"
