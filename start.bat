@echo off
echo ===========================================
echo  PFM Broadcasts - Starting Services
echo ===========================================
echo.
echo Starting PocketBase on port 8090...
start "PocketBase Server" /D "%~dp0" "%~dp0pocketbase.exe" serve --http=127.0.0.1:8090
timeout /t 3 /nobreak >nul

echo Starting Cloudflare Tunnel...
echo.
echo === COPY THE URL BELOW (the https://...trycloudflare.com one) ===
echo.
start "Cloudflare Tunnel" /D "%~dp0" "%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:8090
echo.
echo Once you have the URL, open:
echo   https://fmcg-merch-pwa.vercel.app
echo.
echo Paste the tunnel URL when the connect bar appears.
echo ===========================================
pause
