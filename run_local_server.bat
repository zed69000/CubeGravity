@echo off
cd /d "%~dp0"
echo Gravity Cube - serveur local
echo Ouvre ensuite : http://localhost:8000
python -m http.server 8000
pause
