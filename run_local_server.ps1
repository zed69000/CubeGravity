Set-Location -LiteralPath $PSScriptRoot
Write-Host "Gravity Cube - serveur local"
Write-Host "Ouvre ensuite : http://localhost:8000"
python -m http.server 8000
