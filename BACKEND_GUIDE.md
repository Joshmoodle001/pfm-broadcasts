# PFM Broadcasts — PocketBase Setup Guide

## Architecture

```
[Your Machine]
     │
     ├─ PocketBase binary (1 file, no install)
     │   ├─ SQLite database (unlimited storage)
     │   ├─ File storage for images (unlimited, limited only by disk)
     │   ├─ Auth (email/password, forgot password)
     │   ├─ Realtime (SSE subscriptions)
     │   └─ Admin UI (http://127.0.0.1:8090/_/)
     │
     ├─ Cloudflare Tunnel / Tailscale / ngrok
     │   └─ Exposes :8090 to the internet via HTTPS
     │
     └─ PWA frontend (static files on Vercel/Pages/etc.)
         └─ Calls PocketBase REST API directly
```

## Step 1 — Download PocketBase

Go to [pocketbase.io/docs](https://pocketbase.io/docs) and download the latest release for your OS.

Extract it to your project folder:

```
fmcg-merch-pwa/
  pocketbase.exe    (or ./pocketbase on Linux/Mac)
  pb_schema.json
  index.html
  app.js
  ...
```

## Step 2 — Start PocketBase

**Windows:**
```powershell
.\pocketbase.exe serve --http=127.0.0.1:8090
```

**Mac/Linux:**
```bash
chmod +x pocketbase
./pocketbase serve --http=127.0.0.1:8090
```

First run creates a `pb_data/` directory with the SQLite database.

## Step 3 — Create admin account

1. Open `http://127.0.0.1:8090/_/` in your browser.
2. You'll be prompted to create the first admin account. Use the email and password you want for the app admin.
3. You're now in the Admin UI.

## Step 4 — Add the `role` field to users

The built-in `users` collection needs a `role` field so the app knows who is an admin.

1. In the Admin UI, go to **Collections → users**.
2. Click **+ New field**.
3. Choose **Select**.
4. Name: `role`
5. Values (one per line):
   ```
   admin
   user
   ```
6. Save.
7. Go to **users → your account → Edit** and set `role` to `admin`.

## Step 5 — Import broadcast collections

`pb_schema.json` defines two collections with the correct fields and access rules.

1. Go to **Settings → Import collections**.
2. Paste the contents of `pb_schema.json`.
3. Click **Import**.

This creates:

### `broadcasts` collection

| Field | Type | Notes |
|---|---|---|
| title | text | Max 80 chars |
| message | text | Max 700 chars |
| priority | select | urgent / important / general |
| image | file | JPEG/PNG/WebP, max 10 MB |
| created_by | relation → users | The admin who posted |
| is_active | bool | true = visible, false = deleted |

Access rules:
- **List/View**: `is_active = true` (anyone can see active posts)
- **Create**: only authenticated users with `role = 'admin'`
- **Update**: only admins
- **Delete**: only admins

### `broadcast_reads` collection

| Field | Type | Notes |
|---|---|---|
| broadcast | relation → broadcasts | Cascade delete |
| device_id | text | Anonymous device ID (8-120 chars) |

Access rules:
- **All operations**: open to everyone (read receipts don't need auth)
- **Delete**: only admins (cleanup)

## Step 6 — Configure mail (optional)

For password reset emails, PocketBase needs SMTP settings.

1. Go to **Settings → Mail settings**.
2. Fill in your SMTP server details. A free option:
   - **Resend** (resend.com): 100 emails/day free
   - **Brevo** (brevo.com): 300 emails/day free
   - **Gmail** (with app password): works for low volume

3. Go to **Settings → Mail templates → Reset password**.
4. Customize the template. Default works, but change the action URL to:
   ```
   {APP_URL}/#admin?token={TOKEN}
   ```
5. Set `{APP_URL}` in **Settings → Application → App URL** to your frontend URL.

Without SMTP, PocketBase logs the reset link to the terminal. You can copy it manually for testing.

## Step 7 — Expose PocketBase to the internet

Your phone/browser needs to reach PocketBase from outside your local network. Pick one:

### Option A — Cloudflare Tunnel (free, recommended)

```bash
# Install cloudflared (one-time)
# Windows: download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# Mac: brew install cloudflared
# Linux: follow instructions on the Cloudflare docs

cloudflared tunnel --url http://127.0.0.1:8090
```

Output:
```
Your quick Tunnel has been created!
https://random-name.trycloudflare.com
```

Use this URL as `PB_URL` in app.js.

### Option B — Tailscale Funnel (free, requires Tailscale)

```bash
tailscale funnel 8090
```

Gives you a `https://your-machine.tailnet-name.ts.net` URL.

### Option C — ngrok (free tier)

```bash
ngrok http 8090
```

Gives you a temporary `https://xxxx.ngrok.io` URL.

### Option D — Direct exposure (advanced)

If you have a static IP and domain, set up nginx/caddy as a reverse proxy with SSL (Let's Encrypt). Not recommended unless you know what you're doing.

## Step 8 — Configure PB_URL in app.js

Open `app.js` and set the PocketBase URL:

```js
const PB_URL = localStorage.getItem('pfm_pb_url') || 'https://your-tunnel.trycloudflare.com';
```

Or set it via URL query parameter for quick testing:

```
http://localhost:8080?pb_url=https://your-tunnel.trycloudflare.com
```

The `?pb_url=...` parameter is saved to localStorage automatically by the app.

## Step 9 — Deploy the frontend

The frontend is static HTML/CSS/JS. Deploy it anywhere that serves HTTPS:

- **Vercel**: `npx vercel` in the project folder
- **Cloudflare Pages**: `npx wrangler pages deploy .`
- **GitHub Pages**: push to a repo
- **Netlify**: drag the folder in

Important: Deploy to HTTPS. PWA installation and service workers require HTTPS (except localhost).

## Step 10 — CORS configuration

If your frontend is on a different domain than PocketBase, you need to allow CORS.

**Option A — via CLI flag:**
```bash
./pocketbase serve --http=127.0.0.1:8090 --origins="https://your-frontend.vercel.app,http://localhost:8080"
```

**Option B — via Admin UI:**
Go to Settings → Application → Allowed origins.

## Step 11 — Test the full flow

1. Open your frontend URL (e.g. `https://pfm-broadcasts.vercel.app`).
2. Welcome screen loads with PFM branding.
3. Tap **Admin** → log in with your PocketBase admin email/password.
4. Create a broadcast with title, message, and optional image.
5. Go to **Posts** — the broadcast appears instantly (realtime via SSE).
6. Tap **I have read this** — stored in D1.
7. Open the URL on a second phone — broadcasts appear there too.
8. Tap **Forgot password?** → enter email → check email → reset password.

## Self-hosting 24/7

To keep PocketBase running permanently:

**Windows (as a service):**
Use NSSM (Non-Sucking Service Manager) to run PocketBase as a Windows service.

**Mac (launchd):**
Create a `.plist` file in `~/Library/LaunchAgents/`.

**Linux (systemd):**
```ini
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/pb
ExecStart=/home/youruser/pb/pocketbase serve --http=127.0.0.1:8090
Restart=always

[Install]
WantedBy=multi-user.target
```

**Cheap VPS ($5/mo):**
- Hetzner CX22 (~$4/mo, 40 GB SSD)
- DigitalOcean Droplet ($6/mo)
- BuyVM ($3.50/mo)

Upload the PocketBase binary + `pb_data/` and run it. No Docker, no dependencies.

## Backup

PocketBase stores everything in `pb_data/`. To back up:

```bash
# Stop pocketbase, then:
cp -r pb_data/ pb_backup_$(date +%Y%m%d)/
```

PocketBase also has a built-in backup API:
```
GET /api/backups/create
```

## Demo mode vs PocketBase

| Feature | Demo mode (localStorage) | PocketBase |
|---|---|---|
| Broadcast storage | Browser localStorage | SQLite (unlimited) |
| Cross-device sync | BroadcastChannel (same browser) | Realtime SSE (any device) |
| Admin auth | Hardcoded credentials | Email/password + role check |
| Password reset | Not available | Email + token flow |
| Image uploads | Not available | Built-in file storage |
| User limits | One browser session | Unlimited |
| Storage limit | ~5 MB per browser | Only limited by disk space |
| Realtime | Cross-tab only | SSE push to all devices |
| Cost | Free | Free (your hardware/VPS) |
