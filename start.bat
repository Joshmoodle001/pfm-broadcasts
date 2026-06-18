@echo off
title PFM Broadcasts Server
echo =====================================
echo  PFM Broadcasts - Starting Services
echo =====================================
echo.
echo [1/2] Starting PocketBase...
start "PocketBase" /MIN /D "%~dp0" "%~dp0pocketbase.exe" serve --http=127.0.0.1:8090
timeout /t 3 /nobreak >nul

echo [2/2] Starting Cloudflare Tunnel...
echo.
echo Tunnel URL will appear below after 15 seconds.
echo COPY the https://...trycloudflare.com URL
echo.
start "PFM Tunnel" /MIN cmd /c "cd /d %~dp0 && cloudflared.exe tunnel --url http://127.0.0.1:8090"
timeout /t 12 /nobreak >nul

echo.
echo =====================================================
echo  Services are running in minimized windows.
echo  PocketBase: http://127.0.0.1:8090
echo  App URL:    https://fmcg-merch-pwa.vercel.app
echo =====================================================
echo.
echo When the tunnel URL changes, update the URL in app.js
echo and run: npx vercel --prod
echo.
pause
