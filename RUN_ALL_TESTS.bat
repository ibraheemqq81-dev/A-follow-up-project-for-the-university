@echo off
setlocal
cd /d "%~dp0"
echo [1/4] Type check...
call npm run lint
if errorlevel 1 goto :fail
echo [2/4] Build...
call npm run build
if errorlevel 1 goto :fail
echo [3/4] System tests...
call npm test
if errorlevel 1 goto :fail
echo [4/4] Browser tests...
call npm run test:e2e
if errorlevel 1 goto :fail
echo.
echo All checks passed.
exit /b 0
:fail
echo.
echo A check failed. Review the output above.
exit /b 1
