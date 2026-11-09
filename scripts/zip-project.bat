@echo off
setlocal
REM Dong goi ma nguon BrewLite vao outputs\. Dung --no-pause khi chay tu terminal.

powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0zip-project.ps1"
set "zipExitCode=%errorlevel%"

if not "%zipExitCode%"=="0" (
  echo.
  echo  [LOI] Dong goi that bai. Xem thong bao o tren.
)

if /I not "%~1"=="--no-pause" pause
exit /b %zipExitCode%
