@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "PORT=8000"
set "HOST=127.0.0.1"
set "STAMP=%RANDOM%_%TIME::=%"
set "STAMP=%STAMP: =0%"
set "STAMP=%STAMP:.=%"
set "STAMP=%STAMP:,=%"
set "GAME_URL=http://%HOST%:%PORT%/index.html?v=%STAMP%"
set "EDITOR_URL=http://%HOST%:%PORT%/asset_svg_editor.html?v=%STAMP%"
cls
echo ============================================================
echo   DATE GRAVITY - SERVEUR LOCAL FORCE REFRESH
echo ============================================================
echo Dossier lance : %CD%
echo Port          : %PORT%
echo.
echo Verification version editeur attendue...
findstr /C:"V43.43" "asset_svg_editor.html" >nul 2>nul
if errorlevel 1 (
  echo [ATTENTION] asset_svg_editor.html ne contient pas V43.43.
  echo            Tu n'es peut-etre pas dans le bon dossier.
) else (
  echo [OK] asset_svg_editor.html contient V43.43.
)
echo.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Ancien serveur detecte sur le port %PORT% - PID %%P
  taskkill /PID %%P /F >nul 2>nul
)
set "SERVER_SCRIPT=%TEMP%\date_gravity_no_cache_server_%PORT%.py"
> "%SERVER_SCRIPT%" echo import http.server, socketserver, os
>> "%SERVER_SCRIPT%" echo PORT = int(os.environ.get('PORT', '%PORT%'))
>> "%SERVER_SCRIPT%" echo class Handler(http.server.SimpleHTTPRequestHandler):
>> "%SERVER_SCRIPT%" echo     def end_headers(self):
>> "%SERVER_SCRIPT%" echo         self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
>> "%SERVER_SCRIPT%" echo         self.send_header('Pragma', 'no-cache')
>> "%SERVER_SCRIPT%" echo         self.send_header('Expires', '0')
>> "%SERVER_SCRIPT%" echo         super().end_headers()
>> "%SERVER_SCRIPT%" echo     def log_message(self, format, *args):
>> "%SERVER_SCRIPT%" echo         print('[SERVER]', self.address_string(), '-', format%%args)
>> "%SERVER_SCRIPT%" echo with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
>> "%SERVER_SCRIPT%" echo     print('Serveur no-cache actif sur http://127.0.0.1:%%d' %% PORT)
>> "%SERVER_SCRIPT%" echo     httpd.serve_forever()
echo Lancement du serveur no-cache...
start "Date Gravity Server %PORT%" /min cmd /c "cd /d "%CD%" && set PORT=%PORT% && python "%SERVER_SCRIPT%""
timeout /t 1 /nobreak >nul
echo.
echo Ouverture forcee du JEU / MAIN MENU :
echo %GAME_URL%
echo.
echo Editeur si besoin :
echo %EDITOR_URL%
echo.
start "" "%GAME_URL%"
pause
