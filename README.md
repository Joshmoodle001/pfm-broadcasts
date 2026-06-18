# PFM Broadcasts

A mobile-first installable PWA for simple company-wide broadcasts, powered by PocketBase (self-hosted, unlimited).

## Public user flow

```
Welcome → Posts → I have read this
```

## Admin flow

```
Top-right Admin button → Email/password login → Broadcast Center → Send Broadcast
```

## Run locally

```bash
python -m http.server 8080
```

Open:

```
http://localhost:8080
```

Without PocketBase running, the app falls back to **demo mode** (localStorage + cross-tab sync).

## Demo login (local only)

```
Email: admin@pfm.co.za
Password: PFM2026!
```

## Production backend — PocketBase

1. **Download** PocketBase from [pocketbase.io/docs](https://pocketbase.io/docs) (single binary, no install).
2. **Run it:**
   ```bash
   ./pocketbase serve --http=127.0.0.1:8090
   ```
3. **Open Admin UI:** `http://127.0.0.1:8090/_/` → create your admin account.
4. **Add the `role` field** to the users collection (type: select, values: `admin` / `user`). Set your user's role to `admin`.
5. **Import `pb_schema.json`** via Settings → Import Collections. This creates the `broadcasts` and `broadcast_reads` collections with correct rules.
6. **Configure mail settings** (Admin UI → Settings → Mail) for password reset emails. Or skip this — PocketBase shows reset links in its logs.
7. **Expose PocketBase** to the internet:
   - **Cloudflare Tunnel** (free): `cloudflared tunnel --url http://127.0.0.1:8090`
   - **Tailscale Funnel** (free): `tailscale funnel 8090`
   - **ngrok** (free tier): `ngrok http 8090`
   - **Direct port forward** (if you have a static IP)
8. **Set the URL** in `app.js`:
   ```js
   const PB_URL = localStorage.getItem('pfm_pb_url') || 'https://your-tunnel-url.trycloudflare.com';
   ```
   Or set it via the URL for testing:
   ```
   http://localhost:8080?pb_url=https://your-tunnel-url.trycloudflare.com
   ```

Full instructions in `BACKEND_GUIDE.md`.

## Deploy the frontend

The PWA frontend is just static files. Host it anywhere:

- **Vercel** — drag the folder in, deploy in 30 seconds.
- **Cloudflare Pages** — same thing.
- **GitHub Pages** — push to a repo.
- **Your PocketBase server** — PocketBase can serve static files from `pb_public/` too.

Point the PWA at your PocketBase URL and you're done.

## PWA install

**Android (Chrome):** Open the live HTTPS URL → browser menu → Install app.

**iPhone (Safari):** Open the live HTTPS URL → Share → Add to Home Screen.

## Files

| File | Purpose |
|---|---|
| `index.html` | Main app — HTML, CSS, screen structure |
| `app.js` | App logic, PocketBase SDK, demo mode, PWA |
| `manifest.webmanifest` | PWA metadata, icons, shortcuts |
| `sw.js` | Service worker — offline shell caching |
| `pb_schema.json` | PocketBase collection schema (import via Admin UI) |
| `BACKEND_GUIDE.md` | Full PocketBase setup guide |
| `PRODUCT_CANVAS.md` | Product overview and design rules |
