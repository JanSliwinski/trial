@echo off
echo Installing backend dependencies...
cd backend
pip install -r requirements.txt
echo.
echo Starting HelleniFlex Live Data server...
echo Dashboard: http://localhost:8000
echo API status: http://localhost:8000/api/status
echo.
echo Optional: set ENTSOE_TOKEN=your_token to enable ENTSO-E fallback
echo.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
