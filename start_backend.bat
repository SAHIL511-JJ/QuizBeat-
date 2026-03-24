@echo off
echo Starting QuizBeat Backend on port 8000...
cd /d c:\kahoot\backend
start "QuizBeat Backend" uvicorn app.main:app --host 127.0.0.1 --port 8000
echo Backend started! You can now use MCP tools in your IDE.
pause
