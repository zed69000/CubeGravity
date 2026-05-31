Set-Location -LiteralPath $PSScriptRoot
$Port = 8000
$HostName = "127.0.0.1"
$Stamp = "{0}_{1}" -f (Get-Random), (Get-Date -Format "yyyyMMdd_HHmmss_fff")
$GameUrl = "http://${HostName}:${Port}/index.html?v=$Stamp"
$EditorUrl = "http://${HostName}:${Port}/asset_svg_editor.html?v=$Stamp"
Clear-Host
Write-Host "============================================================"
Write-Host "  DATE GRAVITY - SERVEUR LOCAL FORCE REFRESH"
Write-Host "============================================================"
Write-Host "Dossier lance : $PWD"
Write-Host "Port          : $Port"
Write-Host ""
if (Select-String -Path ".\asset_svg_editor.html" -Pattern "V43.43" -Quiet -ErrorAction SilentlyContinue) { Write-Host "[OK] asset_svg_editor.html contient V43.43." } else { Write-Warning "asset_svg_editor.html ne contient pas V43.43. Tu n'es peut-etre pas dans le bon dossier." }
try { Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "Ancien serveur detecte sur le port $Port - PID $($_.OwningProcess)"; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}
$ServerScript = Join-Path $env:TEMP "date_gravity_no_cache_server_$Port.py"
@"
import http.server, socketserver, os
PORT = int(os.environ.get('PORT', '$Port'))
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, format, *args):
        print('[SERVER]', self.address_string(), '-', format % args)
with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print('Serveur no-cache actif sur http://127.0.0.1:%d' % PORT)
    httpd.serve_forever()
"@ | Set-Content -LiteralPath $ServerScript -Encoding UTF8
Write-Host "Lancement du serveur no-cache..."
Start-Process -WindowStyle Minimized -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$PWD`" && set PORT=$Port && python `"$ServerScript`""
Start-Sleep -Seconds 1
Write-Host ""
Write-Host "Ouverture forcee du JEU / MAIN MENU :"
Write-Host $GameUrl
Write-Host ""
Write-Host "Editeur si besoin :"
Write-Host $EditorUrl
Start-Process $GameUrl
Read-Host "Appuie sur Entree pour fermer cette fenetre"
