$backendDir = Join-Path $PSScriptRoot "backend"
Push-Location $backendDir

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt

Write-Host ""
Write-Host "Starting HelleniFlex Live Data server..." -ForegroundColor Green
Write-Host "  Dashboard : http://localhost:8000" -ForegroundColor Yellow
Write-Host "  API status: http://localhost:8000/api/status" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Optional: `$env:ENTSOE_TOKEN = 'your_token'" -ForegroundColor DarkGray
Write-Host ""

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
