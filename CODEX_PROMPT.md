# Copy-paste prompt for Codex

You are working on a project called **PFM Broadcasts**. The project files are already in this repository/ZIP. Your job is to make the application production-ready, test it, and prepare it for deployment.

## Product goal

Build and finalize a simple, mobile-first PWA broadcasting application for Professional Field Marketing (PFM).

The public user flow must stay very simple:

1. User opens the app.
2. User sees a branded welcome page.
3. User can tap **View Posts**.
4. User sees broadcast posts.
5. User can tap **I have read this** on a post.
6. User can tap **Install App** to install the PWA onto Android home screen, with iPhone/Safari instructions still available.

The admin flow must be quiet and not too forward-facing:

1. A small **Admin** button appears in the top-right corner.
2. Admin opens the admin login page.
3. Admin logs in with email and password.
4. Admin can use **Forgot password?** to trigger a password reset email.
5. Admin can post a broadcast with title, message, and priority.
6. The broadcast appears on all app instances using the backend.

Do not add unnecessary dashboards, role selectors, merchandiser-specific wording, or complex workflows. This is a simple broadcasting app, not a task-management app.

## Current project structure

Expected files include:

```text
index.html
app.js
manifest.webmanifest
sw.js
vercel.json
README.md
BACKEND_GUIDE.md
PRODUCT_CANVAS.md
FULL_COPY_PASTE_CODE.md
CODEX_PROMPT.md
assets/pfm-logo-full.png
assets/pfm-logo-lockup.png
assets/pfm-mark-wide.png
assets/pfm-mark.png
icons/*.png
supabase/schema.sql
```

## Branding requirements

Use the existing PFM assets in the `assets/` and `icons/` folders. Do not replace them with generic icons.

Brand style:

- PFM blue/navy
- PFM golden yellow
- Clean white/light backgrounds
- Corporate but simple
- Rounded cards
- Large mobile-friendly buttons
- Clear readable typography
- Avoid generic blue SaaS styling

Make sure all image paths work:

- `./assets/pfm-logo-lockup.png`
- `./assets/pfm-logo-full.png`
- `./assets/pfm-mark.png`
- `./assets/pfm-mark-wide.png`
- `./icons/icon-192.png`
- `./icons/icon-512.png`
- `./icons/maskable-icon-192.png`
- `./icons/maskable-icon-512.png`
- `./icons/apple-touch-icon-180.png`

If any asset path is wrong, fix the path rather than removing the image.

## Responsive/mobile-first requirements

The app must primarily serve mobile users, but admin may use desktop.

Public mobile requirements:

- Works well at 320px, 360px, 375px, 390px, 414px, and 430px widths.
- Uses `viewport-fit=cover`.
- Respects iPhone safe areas with `env(safe-area-inset-*)`.
- Buttons are large enough for mobile tapping.
- Text does not overflow.
- Cards stack cleanly.
- Bottom navigation does not cover important content.
- Welcome, Posts, Install, and Admin pages all work on small screens.

Desktop requirements:

- Admin Broadcast Center should look good on desktop.
- Do not stretch content too wide; use a readable max width.
- Admin form and recent broadcasts should be comfortable to use on PC.

## PWA requirements

Keep and verify:

- `manifest.webmanifest`
- `sw.js`
- Service worker registration
- Android install prompt handling with `beforeinstallprompt`
- iPhone install instructions using Safari Share -> Add to Home Screen
- App display mode should be `standalone`
- Icons should include normal and maskable icons
- App must work from HTTPS and localhost
- Do not rely on opening `index.html` as a local file for PWA testing

The app should cache the basic app shell:

- `/`
- `index.html`
- `app.js`
- `manifest.webmanifest`
- brand assets
- app icons

Check `sw.js` paths carefully so the service worker does not fail because of missing files.

## Backend requirements

Use Supabase as the recommended backend unless there is a strong reason not to.

Backend must support:

- Admin email/password login
- Forgot password email flow
- Broadcast creation by approved admins only
- Public reading of active broadcasts
- Device-level read acknowledgement
- Realtime broadcast updates across app instances
- Row Level Security policies

Use the existing file:

```text
supabase/schema.sql
```

Review it and improve it if needed.

Expected tables:

1. `broadcasts`
   - `id`
   - `title`
   - `message`
   - `priority`
   - `created_by`
   - `created_at`
   - `is_active`

2. `broadcast_reads`
   - `broadcast_id`
   - `device_id`
   - `read_at`

3. `admin_profiles`
   - `user_id`
   - `is_admin`
   - `created_at`

Backend behaviour:

- Anonymous/public users can read active broadcasts.
- Anonymous/public users can submit read receipts by device ID.
- Only authenticated approved admins can create broadcasts.
- Only authenticated approved admins can deactivate/delete broadcasts if that feature exists.
- The front end should not contain production passwords.
- Demo credentials can remain only as a demo fallback when Supabase is not configured.

## Supabase configuration

The current app has a config object in `app.js`:

```js
const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  PASSWORD_RESET_REDIRECT: `${window.location.origin}${window.location.pathname}#admin`,
};
```

Make this production-safe and easy to configure.

Preferred approach:

- Keep the app simple and static if possible.
- Add clear comments showing where to paste the Supabase URL and anon key.
- If you introduce a build step, document it clearly.
- Do not commit service role keys.
- Do not expose private backend secrets.

## Admin auth requirements

Admin login page fields:

- Email address
- Password
- Login button
- Forgot password link/button

Forgot password flow:

- User enters email.
- App calls Supabase `resetPasswordForEmail`.
- Supabase sends reset email.
- Redirect returns to `#admin`.
- App shows new password form when password recovery state is detected.
- New password is saved using Supabase Auth.

Admin approval:

- Signing in with any Supabase account must not automatically grant admin rights.
- After login, check `admin_profiles` for `is_admin = true`.
- If not approved, sign out and show a simple message.

## Broadcast requirements

Admin Broadcast Center should have:

- Broadcast title
- Message
- Priority radio/select: Urgent, Important, General
- Send Broadcast button
- Recent broadcasts list
- Lock Admin / Sign Out button

Public Posts screen should have:

- Broadcast title
- Broadcast message
- Date/time in South African format if possible
- Priority label
- Read/unread state
- `I have read this` button
- Empty state when no posts exist

Sorting:

- Unread posts first
- Urgent before Important before General
- Newest first within each group

## Exact UI wording guidance

Use these labels or very close versions:

- App name: `PFM Broadcasts`
- Welcome headline: `Welcome to PFM Broadcasts`
- Main CTA: `View Posts`
- Install CTA: `Install App`
- Public page title: `Posts`
- Read button: `I have read this`
- Top-right button: `Admin`
- Admin title: `Admin Access`
- Login button: `Unlock Admin`
- Forgot password link: `Forgot password?`
- Reset button: `Send Reset Email`
- Admin form title: `Send Broadcast`
- Submit button: `Send Broadcast`

Avoid:

- `Merchandiser`
- `Tasks`
- `Audits`
- `Surveys`
- `Dashboard` unless strictly necessary for admin
- Any generic placeholder brand names

## Testing tasks

Run whatever checks are appropriate for this static project.

At minimum:

1. Start a local static server, for example:

```bash
python -m http.server 8080
```

2. Visit:

```text
http://localhost:8080
```

3. Verify these load without 404s:

```text
/
/index.html
/app.js
/manifest.webmanifest
/sw.js
/assets/pfm-logo-lockup.png
/assets/pfm-logo-full.png
/assets/pfm-mark.png
/icons/icon-192.png
/icons/icon-512.png
/icons/maskable-icon-192.png
/icons/maskable-icon-512.png
/icons/apple-touch-icon-180.png
```

4. Check browser console for errors.
5. Validate `manifest.webmanifest` JSON.
6. Validate `vercel.json` JSON.
7. Run a JavaScript syntax check, for example:

```bash
node --check app.js
```

8. Test demo mode:

```text
Email: admin@pfm.co.za
Password: PFM2026!
```

9. In demo mode, create a broadcast and confirm it appears in Posts.
10. Open two browser tabs and confirm demo broadcasts sync through localStorage/BroadcastChannel.
11. Configure Supabase test credentials if available and verify live backend mode.
12. Confirm the app still works when installed/running in standalone PWA mode.

## Deployment requirements

Prepare for Vercel deployment.

Keep or improve `vercel.json` so that:

- Static files serve correctly.
- Manifest has the right content type.
- Service worker is not cached incorrectly.
- Security headers do not break Supabase, images, PWA install, or service worker registration.

Deployment flow:

1. Push repo to GitHub.
2. Import repo into Vercel.
3. Deploy to HTTPS URL.
4. Add Supabase values to `app.js` or build-time config as documented.
5. Test Android install from Chrome.
6. Test iPhone install from Safari.
7. Test admin login on desktop.
8. Test broadcasts appearing on mobile.

## Documentation tasks

Update documentation so a non-expert can follow it.

Ensure `README.md` explains:

- What the app is
- How to run locally
- Demo admin login
- How to deploy
- How to install on Android
- How to install on iPhone
- How to configure Supabase

Ensure `BACKEND_GUIDE.md` explains:

- How to create Supabase project
- How to run `schema.sql`
- How to create admin user
- How to insert admin profile
- How password reset works
- How realtime works
- How the database tables connect to the app
- What is still demo-only versus production-ready

## Acceptance criteria

The work is complete only when:

- The app is branded as PFM Broadcasts everywhere.
- No merchandiser-specific labels remain.
- Welcome -> Posts flow is simple and functional.
- Admin button is small and top-right.
- Admin email/password login works in demo mode and is ready for Supabase.
- Forgot password UI and Supabase integration are present.
- Broadcast creation works in demo mode.
- Supabase backend path is documented and implemented.
- PWA install handling is present and Android-focused, with iPhone instructions.
- All images/icons load correctly.
- The layout is mobile-first and responsive.
- Desktop admin use is comfortable.
- No console errors appear during normal use.
- README and BACKEND_GUIDE are updated.
- Final answer includes a summary of changes and any remaining deployment steps.

## Important constraints

- Do not overcomplicate the public user experience.
- Do not add unnecessary login for normal public users.
- Do not expose production secrets.
- Do not remove the PFM branding assets.
- Do not remove PWA capability.
- Do not hard-code production admin passwords in front-end code.
- Keep the app easy for low-training users.

Please inspect the repository, make the required changes, run checks, and report exactly what changed and how to deploy it.
