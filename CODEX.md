# PFM Broadcasts — Complete Application Reference

## Overview

PFM Broadcasts is a mobile-first PWA broadcasting application for Professional Field Marketing. It allows an admin to post company-wide broadcasts that appear instantly on all connected devices. Public users do not need to log in.

**Live URL:** https://fmcg-merch-pwa.vercel.app  
**Supabase project:** `bmzzbtwhxhijueudznuk`  
**Admin login:** `admin` / `Pfmpfs1234#`

---

## Architecture

```
Browser/Phone (PWA)
    │
    ├─ Vercel CDN (serves index.html + app.js + sw.js + assets)
    │
    ├─ Supabase JS SDK (@supabase/supabase-js@2 from CDN)
    │
    └─ Supabase Backend
         ├─ Auth (email/password)
         ├─ Database (PostgreSQL with RLS)
         ├─ Realtime (Postgres changes via WebSockets)
         └─ Row Level Security
```

---

## File Structure

```
fmcg-merch-pwa/
├── index.html          # Main app — HTML, CSS, screen structure (~30KB)
├── app.js              # All app logic — Supabase, rendering, events (~13KB)
├── manifest.webmanifest # PWA metadata, icons, shortcuts
├── sw.js               # Service worker — offline shell cache
├── vercel.json         # Vercel deployment headers + cache config
├── assets/             # PFM branding images (logo, mark)
│   ├── pfm-logo-full.png
│   ├── pfm-logo-lockup.png
│   ├── pfm-mark.png
│   └── pfm-mark-wide.png
├── icons/              # PWA app icons (72px to 512px, maskable + apple)
└── ARCHITECTURE.md     # Architecture flow diagram
```

---

## Database Schema (Supabase PostgreSQL)

### `broadcasts` table

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key, auto-generated |
| title | text | Max 80 chars, required |
| message | text | Max 700 chars, required |
| priority | text | 'urgent' / 'important' / 'general' |
| image | file | Optional file upload (not currently used by code) |
| created_by | uuid | References auth.users |
| created_at | timestamptz | Auto timestamp |
| updated_at | timestamptz | Auto-updated |
| expires_at | timestamptz | Null = never expires. Set = post moves to Past Posts after this time |
| is_active | boolean | true = visible, false = soft-deleted |

### `broadcast_reads` table

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| broadcast_id | uuid | FK to broadcasts (cascade delete) |
| device_id | text | Anonymous browser-generated device ID (8-120 chars) |
| read_at | timestamptz | Auto timestamp |
| UNIQUE | (broadcast_id, device_id) | Prevents duplicate reads |

### `admin_profiles` table

| Column | Type | Notes |
|---|---|---|
| user_id | uuid | PK, FK to auth.users (cascade delete) |
| full_name | text | Display name |
| is_admin | boolean | Must be true to post/delete |
| created_at | timestamptz | Auto timestamp |

### RLS Policies

**broadcasts:**
- SELECT: `is_active = true` (anyone can read active posts)
- INSERT/UPDATE/DELETE: authenticated users with `admin_profiles.is_admin = true`

**broadcast_reads:**
- All operations: open to everyone

**admin_profiles:**
- SELECT: `true` (anyone can read)

### Auth Triggers

```sql
CREATE FUNCTION auto_approve_first_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_profiles) THEN
    INSERT INTO admin_profiles (user_id, full_name, is_admin)
    VALUES (NEW.id, 'PFM Admin', true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auto_approve_first_admin();
```

---

## app.js — Complete Function Reference

### Configuration Constants

```js
const SUPABASE_URL = 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGci...'; // anon public key
```

### Key Variables

| Variable | Type | Purpose |
|---|---|---|
| `sb` | Object | Supabase client instance |
| `live` | Boolean | true when Supabase is connected |
| `channel` | Object | Supabase realtime channel handle |
| `posts` | Array | Cached broadcast data |
| `reads` | Set | Set of broadcast IDs read by this device |
| `devId` | String | Anonymous device ID (localStorage) |
| `showRead` | Boolean | Toggle between Active/Read tabs |
| `imgCache` | Object | Cached image URLs for this device |

### Initialization Flow

```
app.js loads
  → init() called immediately
    → Polls window.supabase (100ms × 50 attempts = 5s timeout)
    → Creates Supabase client
    → Probes broadcasts table (SELECT id LIMIT 1)
    → On success: live=true, green dot, subscribe realtime
    → On failure: live=false, red dot, demo mode
    → Refresh broadcasts + reads
    → If PWA standalone mode → redirect to posts
    → Otherwise → follow URL hash or show welcome
```

### Rendering Functions

| Function | Purpose |
|---|---|
| `renderPosts()` | Renders Active/Read tab posts into postsList |
| `renderRecent()` | Admin recent broadcasts list (10 items) |
| `renderPast()` | Admin past/expired posts list |
| `renderAdmin()` | Toggles login form vs admin center |
| `renderBody(txt)` | Converts message text to HTML with media detection |
| `render()` | Calls all render functions |

### Media Detection (renderBody)

URLs in message text are auto-detected and rendered appropriately:

| URL Type | How Detected | Rendered As |
|---|---|---|
| Images (.jpg/.png/.webp/.gif) | File extension | "Tap to view image" button |
| Unsplash photos | `images.unsplash.com/photo-` | "Tap to view image" button |
| YouTube | `youtube.com/watch?v=` or `youtu.be/` | Thumbnail card → tap loads iframe player |
| Vimeo | `vimeo.com/` | Thumbnail card → tap loads iframe player |
| MP4/WebM/MOV | `.mp4/.webm/.mov` | Dark card → tap loads native video player |
| Other URLs | Any `https://` | Clickable blue hyperlink |

**Image caching:** After first tap, image URL saved to `localStorage.pfm_imgs`. On subsequent renders, cached images show immediately without requiring a tap.

### Admin Functions

| Function | Description |
|---|---|
| `login()` | `signInWithPassword` → checks `admin_profiles.is_admin` |
| `create()` | Inserts broadcast with optional `expires_at` |
| `del(id)` | Soft-deletes by setting `is_active = false` |
| `admin()` | Returns true if logged in as admin |
| `doLogout()` | Signs out, clears session |

### Screen Navigation

```
switchScreen(screen)
  → Toggles .active class on #screen-{screen}
  → Updates bottom nav button states
  → Replaces URL hash
```

Screens: `welcome`, `posts`, `install`, `admin`

### Event Handlers

| Event | Handler |
|---|---|
| `[data-screen]` click | Switch to that screen |
| `[data-read]` click | Mark broadcast as read (upserts broadcast_reads) |
| `[data-delete]` click | Confirm → delete broadcast |
| `.img-load` click | Load image, save to cache |
| `.vid-card` click | Replace with YouTube iframe or native video player |
| `#adminLoginForm` submit | Admin login |
| `#signupForm` submit | Create new admin account (Supabase only) |
| `#addAdminForm` submit | Existing admin creates new admin |
| `#broadcastForm` submit | Create broadcast |
| `#resetPasswordForm` submit | Send password reset email |
| `#newPasswordForm` submit | Update password |
| `#tabActive` / `#tabRead` click | Toggle Active/Read tabs |
| `hashchange` | Navigate to URL hash screen |
| `beforeinstallprompt` | Capture install prompt for PWA |
| `beforeunload` | Cleanup realtime channel |

---

## PWA Configuration (manifest.webmanifest)

- Display: `standalone`
- Theme color: `#001c52` (PFM navy)
- Background: `#ffffff`
- Orientation: `portrait-primary`
- Icons: 10 sizes from 72×72 to 512×512, plus 2 maskable icons
- Shortcuts: Posts, Install App

---

## Service Worker (sw.js)

- **Install:** Caches all app shell files (index.html, app.js, assets, icons)
- **Activate:** Clears old caches
- **Fetch:** Cache-first for same-origin resources, bypasses Supabase API calls (`/rest/`, `/auth/`)
- **Graceful failure:** Uses `Promise.allSettled` so one missing file doesn't break entire cache

---

## Vercel Configuration (vercel.json)

| Resource | Cache |
|---|---|
| `/*` | public, max-age=86400, stale-while-revalidate=604800 |
| `/sw.js` | no-cache |
| `/manifest.webmanifest` | public, max-age=3600 |
| `/icons/*` | public, max-age=31536000, immutable |
| `/assets/*` | public, max-age=31536000, immutable |

---

## Deployment

### Deploy to Vercel

```bash
npx vercel --prod --yes --scope joshmoodle001s-projects
```

### Update Supabase Keys

Edit `app.js` lines 3-4:
```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
```

### Run Schema on New Supabase Project

```sql
-- Create tables
create table public.admin_profiles (...);
create table public.broadcasts (...);
create table public.broadcast_reads (...);

-- Enable RLS
alter table public.admin_profiles enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_reads enable row level security;

-- Create RLS policies
create policy "anyone read broadcasts" on public.broadcasts for select using (is_active = true);
create policy "admin insert broadcasts" on public.broadcasts for insert to authenticated with check (...);
create policy "admin update broadcasts" on public.broadcasts for update to authenticated using (...);
create policy "admin delete broadcasts" on public.broadcasts for delete to authenticated using (...);
create policy "anyone read admin_profiles" on public.admin_profiles for select using (true);
create policy "public read reads" on public.broadcast_reads for select using (true);
create policy "public insert reads" on public.broadcast_reads for insert with check (true);
create policy "public update reads" on public.broadcast_reads for update using (true);

-- Auto-approve first admin
CREATE FUNCTION auto_approve_first_admin() ...;
CREATE TRIGGER on_auth_user_created ...;

-- Add expires_at column
alter table public.broadcasts add column if not exists expires_at timestamptz;

-- Enable realtime
begin; drop publication if exists supabase_realtime; create publication supabase_realtime; commit;
alter publication supabase_realtime add table public.broadcasts;
alter publication supabase_realtime add table public.broadcast_reads;
```

---

## Data Flow — Post Lifecycle

```
Admin creates post
  → INSERT INTO broadcasts (is_active=true, optional expires_at)
  → Supabase Realtime pushes change to all connected clients
  → All devices refresh their posts list
  → Post sorted by: read status → priority → date

Public user taps "I have read this"
  → UPSERT INTO broadcast_reads (broadcast_id, device_id)
  → Post moves to "Read" tab on that device
  → Other devices unaffected (per-device tracking)

Admin deletes post
  → UPDATE broadcasts SET is_active=false
  → Post disappears from all devices instantly

Timed post expires
  → expires_at < NOW()
  → Post disappears from Active tab (sorted function filters it out)
  → Appears in Admin's "Past Posts" section
  → Not visible to public users
```

---

## Performance Profile

| Metric | Value |
|---|---|
| First load (uncached) | ~40KB |
| Subsequent visits | ~2KB (broadcasts JSON) |
| Images before tap | 0KB |
| Image after tap | ~50KB (cached after first load) |
| Video before tap | 0KB |
| Realtime delta | ~500 bytes per change |
| JS bundle | ~13KB |
| HTML + CSS | ~30KB |
| Supabase SDK | ~120KB (CDN, shared across sites) |
| Service worker cache | App shell only, not API |

---

## Browser Support

- Chrome (Android + Desktop) — full PWA install
- Safari (iOS) — Add to Home Screen via Share menu
- Edge — full PWA install
- Firefox — basic support (no PWA install)

---

## Git

**Repo:** https://github.com/Joshmoodle001/pfm-broadcasts  
**Tag:** `v1.0-working` — last verified working state

### Restore to Working State

```bash
git checkout v1.0-working
npx vercel --prod
```

---

## Configuration Reference

### Supabase
```
Project URL:   https://bmzzbtwhxhijueudznuk.supabase.co
Project Ref:   bmzzbtwhxhijueudznuk
Anon Key:      eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDQzMzIsImV4cCI6MjA5NzM4MDMzMn0.K8r4XYMrSnCXQ4j_FJw7J4cbzuQ9O1RToDsmCUyLQSM
Service Key:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTgwNDMzMiwiZXhwIjoyMDk3MzgwMzMyfQ.uua6_SiWsX0LqFqGa9DBqO8LJEOdTzYkYKA4kkEWV2E
```

### Vercel
```
Team:         joshmoodle001s-projects
Team ID:      team_KoecjwXusaVqiyvMPDHlTElO
Project:      fmcg-merch-pwa
Production:   https://fmcg-merch-pwa.vercel.app
```

### GitHub
```
Repo:         https://github.com/Joshmoodle001/pfm-broadcasts
```

### Admin Account
```
Username:     admin
Password:     Pfmpfs1234#
```

### app.js Config
```js
const SUPABASE_URL = 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGci...';
```

## Known Limitations


1. **Supabase free tier** — 500MB database, 2GB bandwidth/month. For thousands of daily users, upgrade to Pro ($25/month).
2. **Video upload** — Admin form has file input but upload is not wired. Currently uses external URLs embedded in message text.
3. **No push notifications** — Browser Notification API not implemented. Users must open app to see new posts.
4. **Single-org** — No multi-tenant support. One Supabase project = one organization.
