# PFM Broadcasts — Architecture Map

## Flow Diagram

```
Browser opens https://fmcg-merch-pwa.vercel.app
│
├─ Vercel serves index.html (CDN edge, ~30ms)
│   ├─ <script src="supabase-js@2"> — loads Supabase SDK
│   └─ <script src="app.js"> — loads app logic
│
├─ app.js starts
│   ├─ 1. Queries DOM elements (els object)
│   ├─ 2. Registers click handlers
│   ├─ 3. Window 'load' event fires
│   │     └─ initSupabase()
│   │          ├─ Check window.supabase exists
│   │          ├─ Create supabase client
│   │          ├─ Probe: SELECT id FROM broadcasts LIMIT 1
│   │          │   ├─ SUCCESS → live=true, dot=green
│   │          │   └─ FAIL → live=false, dot=red, STOP
│   │          ├─ Start realtime channel
│   │          ├─ Refresh broadcasts from DB
│   │          └─ Restore admin session if cached
│   └─ 4. Render UI
│
├── PUBLIC FLOW ───────────────────────
│   Welcome screen → tap View Posts
│   Posts screen → reads broadcasts table
│   Tap "I have read this" → writes broadcast_reads
│
├── ADMIN FLOW ────────────────────────
│   Tap Admin button (top-right)
│   Login form → signInWithPassword()
│   Check admin_profiles for is_admin=true
│   Broadcast Center → create/delete posts
│
└── REALTIME ──────────────────────────
    Supabase Channel 'p'
    Listens to INSERT/UPDATE/DELETE on broadcasts + broadcast_reads
    Auto-refreshes Posts when data changes
```

## Database Tables

| Table | Purpose | RLS |
|---|---|---|
| `broadcasts` | All posts | Public read (is_active=true), Admin write |
| `broadcast_reads` | Device-level read tracking | Public read/write |
| `admin_profiles` | Admin user approval | Public read, Admin write |

## Critical Failure Points

1. **Supabase SDK CDN** — If `cdn.jsdelivr.net` is blocked/slow, `window.supabase` is undefined, app shows "Offline"
2. **RLS policies** — If policies are missing or wrong, queries fail silently, app shows "Offline"
3. **Supabase project DNS** — If the project URL doesn't resolve, all API calls fail
4. **Admin profile check** — After login, app reads `admin_profiles` WHERE `user_id = auth.uid() AND is_admin = true`. If RLS blocks this, login fails even with correct credentials.
5. **Browser cache** — Old JS in browser cache causes stale behavior. Hard refresh (Ctrl+Shift+R) required after deploy.

## Supabase SDK Init Checklist

- [ ] `window.supabase` exists (CDN loaded)
- [ ] `createClient(url, key)` succeeds
- [ ] `sb.from('broadcasts').select('id').limit(1)` succeeds
- [ ] Broadcasts table has RLS policy allowing anon SELECT
- [ ] admin_profiles table has RLS policy allowing authenticated SELECT

## Deploy Flow

```
git add -A && git commit -m "msg" && git push
npx vercel --prod
```
