# PFM Broadcasts - Full Copy-Paste Code

This file contains the full source code for the current PFM Broadcasts build. Copy each section into the matching file path.

## Project structure

```text
fmcg-merch-pwa/
  index.html
  app.js
  manifest.webmanifest
  sw.js
  vercel.json
  README.md
  BACKEND_GUIDE.md
  PRODUCT_CANVAS.md
  assets/
  icons/
  supabase/
    schema.sql
```

## `index.html`

```html
<!doctype html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="description" content="PFM Broadcasts is a simple installable web app for company-wide broadcasts." />
  <meta name="application-name" content="PFM Broadcasts" />
  <meta name="theme-color" content="#001c52" />
  <meta name="color-scheme" content="light" />
  <meta name="format-detection" content="telephone=no" />

  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="PFM Broadcasts" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="icons/icon-512.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon-180.png" />

  <title>PFM Broadcasts</title>

  <style>
    :root {
      --pfm-blue: #001c52;
      --pfm-blue-2: #07398f;
      --pfm-blue-3: #0b4bd3;
      --pfm-gold: #ffc400;
      --pfm-gold-2: #f2a900;
      --pfm-red: #d71920;
      --pfm-orange: #f59e0b;
      --pfm-green: #15803d;
      --ink: #101828;
      --muted: #667085;
      --line: #d8e0ee;
      --soft: #f4f7fc;
      --card: #ffffff;
      --shadow-sm: 0 8px 24px rgba(0, 28, 82, .08);
      --shadow-lg: 0 24px 70px rgba(0, 28, 82, .16);
      --radius: 24px;
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    html {
      min-height: 100%;
      background: var(--pfm-blue);
      scroll-behavior: smooth;
    }

    body {
      min-height: 100vh;
      min-height: 100dvh;
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(132deg, transparent 0 78%, rgba(255,196,0,.95) 78% 83%, transparent 83% 100%) top right / min(580px, 100vw) 300px no-repeat,
        radial-gradient(circle at top left, rgba(7,57,143,.12), transparent 34rem),
        linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      overflow-x: hidden;
    }

    img { max-width: 100%; }

    button,
    input,
    textarea,
    select { font: inherit; }

    button {
      min-height: 50px;
      border: 0;
      border-radius: 16px;
      padding: 13px 18px;
      background: linear-gradient(135deg, var(--pfm-blue-2), var(--pfm-blue));
      color: #fff;
      font-weight: 850;
      cursor: pointer;
      box-shadow: 0 13px 26px rgba(0, 28, 82, .18);
      touch-action: manipulation;
      transition: transform .14s ease, box-shadow .14s ease, opacity .14s ease, background .14s ease;
    }

    button:hover { box-shadow: 0 16px 30px rgba(0, 28, 82, .23); }
    button:active { transform: translateY(1px); }
    button:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }

    .btn-secondary {
      background: #fff;
      color: var(--pfm-blue);
      border: 1px solid var(--line);
      box-shadow: none;
    }

    .btn-gold {
      background: linear-gradient(135deg, var(--pfm-gold), var(--pfm-gold-2));
      color: var(--pfm-blue);
      box-shadow: 0 13px 26px rgba(242, 169, 0, .24);
    }

    .btn-ghost {
      min-height: 40px;
      padding: 9px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.8);
      color: var(--pfm-blue);
      border: 1px solid rgba(0,28,82,.13);
      box-shadow: none;
      font-size: 12px;
      font-weight: 850;
    }

    .btn-link {
      min-height: auto;
      padding: 0;
      border-radius: 0;
      background: transparent;
      color: var(--pfm-blue-2);
      box-shadow: none;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    input,
    textarea,
    select {
      width: 100%;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 16px;
      padding: 14px 15px;
      color: var(--ink);
      outline: none;
      transition: border-color .14s ease, box-shadow .14s ease;
    }

    textarea {
      min-height: 140px;
      resize: vertical;
      line-height: 1.45;
    }

    input:focus,
    textarea:focus,
    select:focus {
      border-color: var(--pfm-blue-2);
      box-shadow: 0 0 0 4px rgba(7,57,143,.12);
    }

    label {
      display: grid;
      gap: 8px;
      font-size: 13px;
      font-weight: 850;
      color: var(--pfm-blue);
    }

    .app {
      width: min(1120px, 100%);
      min-height: 100vh;
      min-height: 100dvh;
      margin: 0 auto;
      padding: calc(14px + var(--safe-top)) 14px calc(84px + var(--safe-bottom));
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: calc(10px + var(--safe-top)) 0 12px;
      margin-top: calc(-14px - var(--safe-top));
      backdrop-filter: blur(16px);
    }

    .brand-mini {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .brand-mini img {
      width: 84px;
      height: 42px;
      object-fit: contain;
      border-radius: 14px;
      background: #fff;
      box-shadow: var(--shadow-sm);
      padding: 3px;
    }

    .brand-mini span {
      display: none;
      color: var(--pfm-blue);
      font-size: 12px;
      font-weight: 950;
      letter-spacing: .06em;
      text-transform: uppercase;
      line-height: 1.1;
    }

    .screen { display: none; animation: rise .18s ease-out; }
    .screen.active { display: block; }

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .welcome-layout {
      display: grid;
      gap: 16px;
    }

    .hero {
      position: relative;
      overflow: hidden;
      min-height: calc(100dvh - 122px - var(--safe-top) - var(--safe-bottom));
      border-radius: 32px;
      background: linear-gradient(145deg, var(--pfm-blue) 0%, #07398f 100%);
      color: #fff;
      padding: clamp(22px, 6vw, 44px);
      display: grid;
      align-content: space-between;
      gap: 42px;
      box-shadow: var(--shadow-lg);
      isolation: isolate;
    }

    .hero::before,
    .hero::after {
      content: "";
      position: absolute;
      pointer-events: none;
      z-index: -1;
      transform: rotate(-52deg);
      border-radius: 999px;
    }

    .hero::before {
      right: -48px;
      top: -92px;
      width: 82px;
      height: 330px;
      background: linear-gradient(180deg, var(--pfm-gold), var(--pfm-gold-2));
    }

    .hero::after {
      right: 86px;
      bottom: -160px;
      width: 42px;
      height: 290px;
      background: rgba(255,255,255,.12);
    }

    .hero-logo {
      width: min(190px, 65vw);
      padding: 12px;
      border-radius: 22px;
      background: #fff;
      box-shadow: 0 15px 35px rgba(0,0,0,.18);
    }

    .hero-logo img { display: block; width: 100%; }

    .hero h1 {
      margin: 28px 0 0;
      font-size: clamp(44px, 14vw, 88px);
      line-height: .88;
      letter-spacing: -.07em;
      max-width: 720px;
    }

    .hero p {
      max-width: 620px;
      margin: 18px 0 0;
      color: rgba(255,255,255,.84);
      font-size: clamp(16px, 4.2vw, 20px);
      line-height: 1.48;
    }

    .hero-actions {
      display: grid;
      gap: 12px;
    }

    .hero-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 18px;
      padding: 14px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 18px;
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.82);
      font-size: 13px;
      line-height: 1.45;
    }

    .install-card,
    .panel,
    .post-card,
    .empty,
    .admin-card {
      border: 1px solid rgba(216,224,238,.9);
      border-radius: var(--radius);
      background: rgba(255,255,255,.94);
      box-shadow: var(--shadow-sm);
    }

    .install-card {
      padding: 20px;
      display: grid;
      gap: 15px;
    }

    .install-heading {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .install-icon {
      width: 52px;
      height: 52px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, var(--pfm-gold), var(--pfm-gold-2));
      color: var(--pfm-blue);
      font-size: 24px;
      font-weight: 950;
      flex: 0 0 auto;
    }

    .install-card h2,
    .panel h2,
    .admin-card h2 { margin: 0; color: var(--pfm-blue); }

    .install-card p,
    .panel p,
    .admin-card p,
    .empty p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .steps {
      display: grid;
      gap: 10px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }

    .steps strong { color: var(--pfm-blue); }

    .posts-shell {
      display: grid;
      gap: 16px;
    }

    .page-title {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 2px 2px;
    }

    .page-title h1 {
      margin: 0;
      color: var(--pfm-blue);
      font-size: clamp(30px, 8vw, 56px);
      line-height: .95;
      letter-spacing: -.05em;
    }

    .page-title p {
      margin: 8px 0 0;
      color: var(--muted);
      line-height: 1.4;
      font-weight: 650;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border-radius: 999px;
      padding: 7px 10px;
      background: #fff;
      color: var(--pfm-blue);
      border: 1px solid var(--line);
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
    }

    .posts-list {
      display: grid;
      gap: 12px;
    }

    .post-card {
      overflow: hidden;
      padding: 17px;
      display: grid;
      gap: 12px;
      position: relative;
    }

    .post-card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 5px;
      background: var(--pfm-blue-2);
    }

    .post-card.urgent::before { background: var(--pfm-red); }
    .post-card.important::before { background: var(--pfm-gold-2); }
    .post-card.general::before { background: var(--pfm-blue-2); }
    .post-card.read { opacity: .82; }

    .post-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .post-card h3 {
      margin: 0;
      color: var(--ink);
      font-size: clamp(19px, 5.5vw, 26px);
      letter-spacing: -.02em;
      line-height: 1.05;
    }

    .post-card p {
      margin: 0;
      color: #344054;
      line-height: 1.52;
      white-space: pre-wrap;
    }

    .tag {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .04em;
      border: 1px solid transparent;
    }

    .tag.urgent { color: var(--pfm-red); background: #fff1f2; border-color: #fecdd3; }
    .tag.important { color: #a15c00; background: #fffbeb; border-color: #fed7aa; }
    .tag.general { color: var(--pfm-blue-2); background: #eff6ff; border-color: #bfdbfe; }
    .tag.read { color: var(--pfm-green); background: #ecfdf3; border-color: #bbf7d0; }

    .post-meta {
      display: grid;
      gap: 10px;
      align-items: center;
      color: var(--muted);
      font-size: 13px;
      font-weight: 750;
    }

    .post-meta button { width: 100%; }

    .empty {
      padding: 24px;
      text-align: center;
      color: var(--muted);
      line-height: 1.5;
    }

    .admin-shell {
      display: grid;
      gap: 16px;
      max-width: 980px;
      margin: 0 auto;
    }

    .admin-card {
      padding: clamp(18px, 4vw, 28px);
      display: grid;
      gap: 18px;
    }

    .admin-logo {
      width: 132px;
      margin: 0 auto;
      display: block;
    }

    .admin-locked {
      max-width: 460px;
      margin: 0 auto;
      text-align: center;
    }

    .form-grid {
      display: grid;
      gap: 14px;
    }

    .form-actions {
      display: grid;
      gap: 10px;
    }

    .priority-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .priority-option {
      position: relative;
      display: block;
    }

    .priority-option input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .priority-option span {
      display: grid;
      place-items: center;
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      color: var(--pfm-blue);
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }

    .priority-option input:checked + span {
      border-color: var(--pfm-blue-2);
      background: #eff6ff;
      box-shadow: 0 0 0 4px rgba(7,57,143,.10);
    }

    .admin-layout {
      display: grid;
      gap: 14px;
    }

    .recent-list {
      display: grid;
      gap: 10px;
    }

    .recent-item {
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fff;
      display: grid;
      gap: 4px;
    }

    .recent-item strong { color: var(--ink); }
    .recent-item span { color: var(--muted); font-size: 12px; font-weight: 700; }

    .hidden { display: none !important; }

    .bottom-nav {
      position: fixed;
      z-index: 60;
      left: 50%;
      bottom: calc(12px + var(--safe-bottom));
      transform: translateX(-50%);
      width: min(450px, calc(100% - 28px));
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      padding: 8px;
      border-radius: 22px;
      background: rgba(255,255,255,.88);
      border: 1px solid rgba(216,224,238,.9);
      box-shadow: 0 18px 50px rgba(0,28,82,.18);
      backdrop-filter: blur(18px);
    }

    .nav-btn {
      min-height: 48px;
      padding: 10px;
      border-radius: 16px;
      background: transparent;
      color: var(--muted);
      box-shadow: none;
    }

    .nav-btn.active {
      background: var(--pfm-blue);
      color: #fff;
    }

    .toast {
      position: fixed;
      z-index: 80;
      left: 50%;
      bottom: calc(88px + var(--safe-bottom));
      transform: translate(-50%, 18px);
      opacity: 0;
      pointer-events: none;
      background: var(--pfm-blue);
      color: #fff;
      padding: 12px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 850;
      box-shadow: 0 18px 50px rgba(0,28,82,.22);
      transition: opacity .18s ease, transform .18s ease;
    }

    .toast.show {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    .status-banner {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .status-banner strong { color: var(--pfm-blue); }

    @media (min-width: 620px) {
      .brand-mini span { display: block; }
      .hero-actions { grid-template-columns: repeat(2, minmax(0, 220px)); }
      .post-meta { grid-template-columns: 1fr auto; }
      .post-meta button { width: auto; }
      .form-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (min-width: 860px) {
      .app { padding: calc(18px + var(--safe-top)) 24px 34px; }
      .topbar { margin-top: calc(-18px - var(--safe-top)); padding-top: calc(14px + var(--safe-top)); }
      .welcome-layout { grid-template-columns: minmax(0, 1.15fr) 390px; align-items: stretch; }
      .hero { min-height: 620px; }
      .install-card { align-content: start; }
      .posts-shell { grid-template-columns: minmax(0, 1fr) 330px; align-items: start; }
      .page-title { grid-column: 1 / -1; }
      .desktop-panel { display: grid; }
      .admin-layout { grid-template-columns: minmax(0, 1.2fr) minmax(300px, .8fr); align-items: start; }
      .bottom-nav { display: none; }
    }

    @media (max-width: 360px) {
      .priority-row { grid-template-columns: 1fr; }
      .post-top { display: grid; }
      button { padding-left: 14px; padding-right: 14px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .001ms !important;
        transition-duration: .001ms !important;
        scroll-behavior: auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <button class="brand-mini btn-link" type="button" data-screen="welcome" aria-label="Go to welcome screen">
        <img src="assets/pfm-mark-wide.png" alt="PFM logo" />
        <span>Professional Field<br>Marketing</span>
      </button>
      <button class="btn-ghost" type="button" data-screen="admin" aria-label="Open admin access">🔒 Admin</button>
    </header>

    <main>
      <section class="screen active" id="screen-welcome" aria-labelledby="welcomeTitle">
        <div class="welcome-layout">
          <article class="hero">
            <div>
              <div class="hero-logo">
                <img src="assets/pfm-logo-lockup.png" alt="Professional Field Marketing logo" />
              </div>
              <h1 id="welcomeTitle">PFM Broadcasts</h1>
              <p>Company broadcasts in one simple place. Open the app, view posts, and stay informed.</p>
            </div>

            <div>
              <div class="hero-actions">
                <button type="button" data-screen="posts">View Posts</button>
                <button class="btn-gold" type="button" data-screen="install">Install App</button>
              </div>
              <div class="hero-note">
                <strong>✓</strong>
                <span>Designed for mobile first, with a simple desktop admin experience for posting broadcasts.</span>
              </div>
            </div>
          </article>

          <aside class="install-card" aria-labelledby="quickInstallTitle">
            <div class="install-heading">
              <div class="install-icon">↓</div>
              <div>
                <h2 id="quickInstallTitle">Install on Android</h2>
                <p>Open this website in Chrome, then add it to the home screen.</p>
              </div>
            </div>
            <div class="steps">
              <div><strong>1.</strong> Open the live PFM Broadcasts link in Chrome.</div>
              <div><strong>2.</strong> Tap the browser menu or the install prompt.</div>
              <div><strong>3.</strong> Tap <strong>Install</strong> or <strong>Add to Home screen</strong>.</div>
            </div>
            <button type="button" id="installFromWelcomeBtn">Install App</button>
            <button class="btn-secondary" type="button" data-screen="posts">Skip and view posts</button>
          </aside>
        </div>
      </section>

      <section class="screen" id="screen-install" aria-labelledby="installTitle">
        <div class="posts-shell">
          <div class="page-title">
            <div>
              <h1 id="installTitle">Install App</h1>
              <p>Add PFM Broadcasts to your phone for quick access.</p>
            </div>
          </div>

          <article class="install-card">
            <div class="install-heading">
              <div class="install-icon">📱</div>
              <div>
                <h2>Android website install</h2>
                <p>Best used through Chrome on Android.</p>
              </div>
            </div>
            <button type="button" id="installBtn">Check install option</button>
            <div class="steps" id="installSteps"></div>
          </article>

          <aside class="install-card">
            <h2>iPhone</h2>
            <div class="steps">
              <div><strong>1.</strong> Open the site in Safari.</div>
              <div><strong>2.</strong> Tap the Share button.</div>
              <div><strong>3.</strong> Choose <strong>Add to Home Screen</strong>.</div>
            </div>
          </aside>
        </div>
      </section>

      <section class="screen" id="screen-posts" aria-labelledby="postsTitle">
        <div class="posts-shell">
          <div class="page-title">
            <div>
              <h1 id="postsTitle">Posts</h1>
              <p>Read the latest broadcasts from PFM.</p>
            </div>
            <span class="pill" id="postCount">0 posts</span>
          </div>

          <div class="posts-list" id="postsList"></div>

          <aside class="install-card desktop-panel">
            <h2>About PFM Broadcasts</h2>
            <p>Simple company communication. Admin posts once, and every app instance receives the broadcast when the backend is connected.</p>
            <button class="btn-secondary" type="button" data-screen="install">Install on phone</button>
          </aside>
        </div>
      </section>

      <section class="screen" id="screen-admin" aria-labelledby="adminTitle">
        <div class="admin-shell">
          <div class="page-title">
            <div>
              <h1 id="adminTitle">Admin</h1>
              <p>Locked area for posting broadcasts.</p>
            </div>
          </div>

          <article class="admin-card admin-locked" id="adminLoginCard">
            <img class="admin-logo" src="assets/pfm-logo-lockup.png" alt="PFM logo" />
            <div>
              <h2>Admin Access</h2>
              <p>Only authorised admins can create and send broadcasts.</p>
            </div>

            <form class="form-grid" id="adminLoginForm">
              <label>
                Email address
                <input id="adminEmail" name="email" type="email" autocomplete="username" placeholder="admin@pfm.co.za" required />
              </label>
              <label>
                Password
                <input id="adminPassword" name="password" type="password" autocomplete="current-password" placeholder="Enter password" required />
              </label>
              <button type="submit">Unlock Admin</button>
              <button class="btn-link" type="button" id="showResetBtn">Forgot password?</button>
            </form>

            <form class="form-grid hidden" id="resetPasswordForm">
              <label>
                Admin email
                <input id="resetEmail" name="resetEmail" type="email" autocomplete="email" placeholder="admin@pfm.co.za" required />
              </label>
              <button type="submit">Send Reset Email</button>
              <button class="btn-link" type="button" id="backToLoginBtn">Back to login</button>
            </form>

            <form class="form-grid hidden" id="newPasswordForm">
              <label>
                New password
                <input id="newPassword" name="newPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Enter new password" required />
              </label>
              <button type="submit">Update Password</button>
            </form>
          </article>

          <div class="admin-layout hidden" id="adminCenter">
            <article class="admin-card">
              <div>
                <h2>Broadcast Center</h2>
                <p>Create a post and send it to the whole app.</p>
              </div>

              <form class="form-grid" id="broadcastForm">
                <label>
                  Broadcast title
                  <input id="title" name="title" maxlength="80" placeholder="Example: Price Update Effective Today" required />
                </label>
                <label>
                  Message
                  <textarea id="body" name="body" maxlength="700" placeholder="Type the broadcast message here..." required></textarea>
                </label>
                <label>
                  Priority
                  <div class="priority-row" role="radiogroup" aria-label="Broadcast priority">
                    <label class="priority-option"><input type="radio" name="priority" value="urgent" /><span>Urgent</span></label>
                    <label class="priority-option"><input type="radio" name="priority" value="important" checked /><span>Important</span></label>
                    <label class="priority-option"><input type="radio" name="priority" value="general" /><span>General</span></label>
                  </div>
                </label>
                <button type="submit">Send Broadcast</button>
              </form>
            </article>

            <aside class="admin-card">
              <h2>Admin Tools</h2>
              <div class="status-banner" id="backendStatus"></div>
              <div class="form-actions">
                <button class="btn-secondary" type="button" id="seedBtn">Add demo posts</button>
                <button class="btn-secondary" type="button" id="clearBtn">Clear demo posts</button>
                <button class="btn-secondary" type="button" id="lockAdminBtn">Lock admin</button>
              </div>
              <div>
                <h2>Recent</h2>
                <div class="recent-list" id="recentList"></div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  </div>

  <nav class="bottom-nav" aria-label="Main navigation">
    <button class="nav-btn active" type="button" data-screen="welcome">Welcome</button>
    <button class="nav-btn" type="button" data-screen="posts">Posts</button>
  </nav>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="app.js"></script>
</body>
</html>

```

## `app.js`

```javascript
'use strict';

/*
  PFM Broadcasts
  ------------------------------------------------------------
  Mobile-first PWA for company-wide broadcast posts.

  Demo mode:
  - Works immediately with localStorage on one browser/device.

  Production mode:
  - Add your Supabase project URL and anon key below.
  - Run the SQL in supabase/schema.sql.
  - Create admin users in Supabase Auth and admin_profiles.
*/

const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  PASSWORD_RESET_REDIRECT: `${window.location.origin}${window.location.pathname}#admin`,
};

const STORAGE_KEY = 'pfm_broadcasts_items_v5';
const DEVICE_KEY = 'pfm_broadcasts_device_id_v5';
const ADMIN_SESSION_KEY = 'pfm_broadcasts_admin_unlocked_v5';
const CHANNEL_NAME = 'pfm_broadcasts_channel_v5';

// Demo-only login. This is ignored once Supabase is configured.
// Production passwords must live in Supabase Auth, never in front-end code.
const DEMO_ADMIN_EMAIL = 'admin@pfm.co.za';
const DEMO_ADMIN_PASSWORD = 'PFM2026!';

const priorityWeight = { urgent: 3, important: 2, general: 1 };
const localChannel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
let deferredInstallPrompt = null;
let activeScreen = 'welcome';
let supabaseClient = null;
let realtimeChannel = null;
let cachedBroadcasts = [];
let cachedReads = new Set();
let currentAdminUser = null;
let passwordRecoveryMode = false;

const els = {
  postsList: document.querySelector('#postsList'),
  postCount: document.querySelector('#postCount'),
  recentList: document.querySelector('#recentList'),
  adminLoginCard: document.querySelector('#adminLoginCard'),
  adminCenter: document.querySelector('#adminCenter'),
  adminLoginForm: document.querySelector('#adminLoginForm'),
  adminEmail: document.querySelector('#adminEmail'),
  adminPassword: document.querySelector('#adminPassword'),
  resetPasswordForm: document.querySelector('#resetPasswordForm'),
  resetEmail: document.querySelector('#resetEmail'),
  newPasswordForm: document.querySelector('#newPasswordForm'),
  newPassword: document.querySelector('#newPassword'),
  showResetBtn: document.querySelector('#showResetBtn'),
  backToLoginBtn: document.querySelector('#backToLoginBtn'),
  lockAdminBtn: document.querySelector('#lockAdminBtn'),
  broadcastForm: document.querySelector('#broadcastForm'),
  title: document.querySelector('#title'),
  body: document.querySelector('#body'),
  seedBtn: document.querySelector('#seedBtn'),
  clearBtn: document.querySelector('#clearBtn'),
  installBtn: document.querySelector('#installBtn'),
  installFromWelcomeBtn: document.querySelector('#installFromWelcomeBtn'),
  installSteps: document.querySelector('#installSteps'),
  backendStatus: document.querySelector('#backendStatus'),
  toast: document.querySelector('#toast'),
};

function hasBackendConfig() {
  return Boolean(
    CONFIG.SUPABASE_URL &&
    CONFIG.SUPABASE_ANON_KEY &&
    CONFIG.SUPABASE_URL.startsWith('https://') &&
    window.supabase &&
    typeof window.supabase.createClient === 'function'
  );
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

const deviceId = getDeviceId();

function sanitize(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function formatDate(iso) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function priorityLabel(priority) {
  return { urgent: 'Urgent', important: 'Important', general: 'General' }[priority] || 'General';
}

function normaliseBroadcast(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body || row.message,
    priority: row.priority || 'general',
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    createdBy: row.createdBy || row.created_by || null,
    readBy: row.readBy || [],
    isActive: row.isActive ?? row.is_active ?? true,
  };
}

function isRead(item) {
  if (hasBackendConfig()) return cachedReads.has(item.id);
  return Array.isArray(item.readBy) && item.readBy.includes(deviceId);
}

function sortBroadcasts(items) {
  return [...items]
    .filter(item => item.isActive !== false)
    .sort((a, b) => {
      const aRead = isRead(a) ? 1 : 0;
      const bRead = isRead(b) ? 1 : 0;
      if (aRead !== bRead) return aRead - bRead;

      const aPriority = priorityWeight[a.priority] || 0;
      const bPriority = priorityWeight[b.priority] || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function getLocalBroadcasts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved.map(normaliseBroadcast) : [];
  } catch (error) {
    console.warn('Could not read local broadcasts', error);
    return [];
  }
}

function saveLocalBroadcasts(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  cachedBroadcasts = items.map(normaliseBroadcast);
  if (localChannel) localChannel.postMessage({ type: 'broadcasts-updated' });
  render();
}

async function initBackend() {
  if (!hasBackendConfig()) {
    cachedBroadcasts = getLocalBroadcasts();
    return;
  }

  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentAdminUser = session?.user || null;
    if (event === 'PASSWORD_RECOVERY') {
      passwordRecoveryMode = true;
      showNewPasswordForm();
      switchScreen('admin');
    }
    await verifyAdminSession();
    renderAdminState();
  });

  const { data } = await supabaseClient.auth.getSession();
  currentAdminUser = data?.session?.user || null;
  await verifyAdminSession();

  await refreshFromBackend();
  subscribeToRealtime();
}

async function verifyAdminSession() {
  if (!hasBackendConfig()) return;
  if (!currentAdminUser) {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return;
  }

  const { data, error } = await supabaseClient
    .from('admin_profiles')
    .select('user_id,is_admin')
    .eq('user_id', currentAdminUser.id)
    .eq('is_admin', true)
    .maybeSingle();

  if (error || !data) {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    if (error) console.warn('Admin verification failed', error);
    return;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
}

async function refreshFromBackend() {
  if (!hasBackendConfig()) return;

  const [broadcastResponse, readResponse] = await Promise.all([
    supabaseClient
      .from('broadcasts')
      .select('id,title,message,priority,created_at,created_by,is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseClient
      .from('broadcast_reads')
      .select('broadcast_id')
      .eq('device_id', deviceId),
  ]);

  if (broadcastResponse.error) {
    console.error('Could not load broadcasts', broadcastResponse.error);
    showToast('Could not load posts');
    return;
  }

  if (readResponse.error) {
    console.warn('Could not load read receipts', readResponse.error);
  }

  cachedBroadcasts = (broadcastResponse.data || []).map(normaliseBroadcast);
  cachedReads = new Set((readResponse.data || []).map(row => row.broadcast_id));
  render();
}

function subscribeToRealtime() {
  if (!hasBackendConfig() || realtimeChannel) return;

  realtimeChannel = supabaseClient
    .channel('pfm-broadcasts-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, refreshFromBackend)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_reads' }, refreshFromBackend)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') renderBackendStatus();
    });
}

function isAdminUnlocked() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

function setAdminUnlocked(value) {
  if (value) sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
  else sessionStorage.removeItem(ADMIN_SESSION_KEY);
  renderAdminState();
}

async function createBroadcast({ title, body, priority }) {
  if (hasBackendConfig()) {
    if (!isAdminUnlocked()) throw new Error('Admin is not unlocked.');

    const { error } = await supabaseClient.from('broadcasts').insert({
      title,
      message: body,
      priority,
      created_by: currentAdminUser?.id || null,
      is_active: true,
    });

    if (error) throw error;
    await refreshFromBackend();
    return;
  }

  const item = normaliseBroadcast({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    title,
    body,
    priority,
    createdAt: new Date().toISOString(),
    readBy: [],
    isActive: true,
  });
  saveLocalBroadcasts([item, ...getLocalBroadcasts()]);
}

async function markRead(id) {
  if (hasBackendConfig()) {
    const { error } = await supabaseClient
      .from('broadcast_reads')
      .upsert({ broadcast_id: id, device_id: deviceId }, { onConflict: 'broadcast_id,device_id' });

    if (error) {
      console.error('Could not mark as read', error);
      showToast('Could not mark as read');
      return;
    }

    cachedReads.add(id);
    render();
    showToast('Marked as read');
    return;
  }

  const updated = getLocalBroadcasts().map(item => {
    if (item.id !== id) return item;
    const readBy = new Set(item.readBy || []);
    readBy.add(deviceId);
    return { ...item, readBy: Array.from(readBy) };
  });
  saveLocalBroadcasts(updated);
  showToast('Marked as read');
}

function createPostCard(item) {
  const read = isRead(item);
  const card = document.createElement('article');
  card.className = `post-card ${read ? 'read' : 'unread'} ${sanitize(item.priority)}`;
  card.innerHTML = `
    <div class="post-top">
      <h3>${sanitize(item.title)}</h3>
      <span class="tag ${read ? 'read' : sanitize(item.priority)}">${read ? 'Read' : priorityLabel(item.priority)}</span>
    </div>
    <p>${sanitize(item.body)}</p>
    <div class="post-meta">
      <span>${formatDate(item.createdAt)}</span>
      <button class="${read ? 'btn-secondary' : ''}" type="button" data-read-id="${sanitize(item.id)}">${read ? 'Read again' : 'I have read this'}</button>
    </div>
  `;
  return card;
}

function createRecentItem(item) {
  const el = document.createElement('div');
  el.className = 'recent-item';
  el.innerHTML = `
    <strong>${sanitize(item.title)}</strong>
    <span>${priorityLabel(item.priority)} - ${formatDate(item.createdAt)}</span>
  `;
  return el;
}

function renderPosts() {
  const items = sortBroadcasts(cachedBroadcasts);
  const unreadCount = items.filter(item => !isRead(item)).length;

  els.postCount.textContent = items.length === 1 ? '1 post' : `${items.length} posts`;
  if (unreadCount) els.postCount.textContent += ` - ${unreadCount} unread`;

  els.postsList.innerHTML = '';

  if (!items.length) {
    els.postsList.innerHTML = `
      <div class="empty">
        <strong>No posts yet.</strong>
        <p>When admin sends a broadcast, it will appear here.</p>
      </div>
    `;
    return;
  }

  items.forEach(item => els.postsList.appendChild(createPostCard(item)));
}

function renderRecent() {
  if (!els.recentList) return;
  const items = [...cachedBroadcasts]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  els.recentList.innerHTML = '';

  if (!items.length) {
    els.recentList.innerHTML = '<div class="empty"><strong>No broadcasts sent yet.</strong></div>';
    return;
  }

  items.forEach(item => els.recentList.appendChild(createRecentItem(item)));
}

function renderAdminState() {
  const unlocked = isAdminUnlocked();
  els.adminLoginCard.classList.toggle('hidden', unlocked);
  els.adminCenter.classList.toggle('hidden', !unlocked);

  if (!unlocked && !passwordRecoveryMode) showLoginForm(false);
  renderBackendStatus();
}

function renderBackendStatus() {
  if (!els.backendStatus) return;

  if (hasBackendConfig()) {
    els.backendStatus.innerHTML = `
      <strong>Live backend connected</strong>
      <span>Broadcasts are loaded from Supabase and can update across devices when Realtime is enabled.</span>
    `;
    return;
  }

  els.backendStatus.innerHTML = `
    <strong>Demo mode</strong>
    <span>This prototype is using localStorage. Add Supabase URL and anon key in app.js for real cross-device broadcasting.</span>
  `;
}

function showLoginForm(focus = true) {
  passwordRecoveryMode = false;
  els.adminLoginForm.classList.remove('hidden');
  els.resetPasswordForm.classList.add('hidden');
  els.newPasswordForm.classList.add('hidden');
  if (focus) window.setTimeout(() => els.adminEmail?.focus(), 80);
}

function showResetForm() {
  passwordRecoveryMode = false;
  els.adminLoginForm.classList.add('hidden');
  els.resetPasswordForm.classList.remove('hidden');
  els.newPasswordForm.classList.add('hidden');
  els.resetEmail.value = els.adminEmail.value || '';
  window.setTimeout(() => els.resetEmail?.focus(), 80);
}

function showNewPasswordForm() {
  els.adminLoginForm.classList.add('hidden');
  els.resetPasswordForm.classList.add('hidden');
  els.newPasswordForm.classList.remove('hidden');
  window.setTimeout(() => els.newPassword?.focus(), 80);
}

function renderInstallSteps() {
  if (!els.installSteps) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  if (isStandalone) {
    els.installSteps.innerHTML = '<div><strong>Installed.</strong> PFM Broadcasts is already running from the home screen.</div>';
    els.installBtn.disabled = true;
    els.installBtn.textContent = 'Already installed';
    return;
  }

  if (deferredInstallPrompt) {
    els.installSteps.innerHTML = '<div><strong>Ready.</strong> Tap Install App and confirm the Android install prompt.</div>';
    els.installBtn.disabled = false;
    els.installBtn.textContent = 'Install PFM Broadcasts';
    return;
  }

  if (isAndroid) {
    els.installSteps.innerHTML = `
      <div><strong>Android Chrome:</strong> open the browser menu and choose Install app or Add to Home screen.</div>
      <div>If the prompt does not show immediately, make sure this site is running on HTTPS.</div>
    `;
    els.installBtn.disabled = true;
    els.installBtn.textContent = 'Use Chrome menu';
    return;
  }

  if (isIOS) {
    els.installSteps.innerHTML = `
      <div><strong>iPhone:</strong> open in Safari, tap Share, then choose Add to Home Screen.</div>
    `;
    els.installBtn.disabled = true;
    els.installBtn.textContent = 'Use Safari Share';
    return;
  }

  els.installSteps.innerHTML = '<div><strong>Desktop:</strong> use the install icon in Chrome or Edge if it appears in the address bar.</div>';
  els.installBtn.disabled = true;
  els.installBtn.textContent = 'Install option not shown yet';
}

function render() {
  renderPosts();
  renderRecent();
  renderAdminState();
  renderInstallSteps();
}

function switchScreen(screen) {
  activeScreen = screen;
  document.querySelectorAll('.screen').forEach(item => {
    item.classList.toggle('active', item.id === `screen-${screen}`);
  });
  document.querySelectorAll('.nav-btn').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });

  if (screen === 'admin') renderAdminState();
  if (window.location.hash !== `#${screen}`) history.replaceState(null, '', `#${screen}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function seedDemoPosts() {
  const now = Date.now();
  const demoItems = [
    {
      id: crypto.randomUUID ? crypto.randomUUID() : `${now}-1`,
      title: 'Price Update Effective Today',
      body: 'New pricing is effective from today. Please make sure the latest information has been shared and followed.',
      priority: 'urgent',
      createdAt: new Date(now).toISOString(),
      readBy: [],
      isActive: true,
    },
    {
      id: crypto.randomUUID ? crypto.randomUUID() : `${now}-2`,
      title: 'Holiday Schedule Notice',
      body: 'Office support will be limited on the public holiday. Please check the latest schedule before planning follow-ups.',
      priority: 'important',
      createdAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
      readBy: [],
      isActive: true,
    },
    {
      id: crypto.randomUUID ? crypto.randomUUID() : `${now}-3`,
      title: 'New Product Launch',
      body: 'A new product launch is planned for next week. More details will follow in the next broadcast.',
      priority: 'general',
      createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
      readBy: [],
      isActive: true,
    },
  ].map(normaliseBroadcast);

  saveLocalBroadcasts(demoItems);
  showToast('Demo posts added');
}

async function clearDemoPosts() {
  if (hasBackendConfig()) {
    showToast('Clear is disabled for live backend');
    return;
  }
  saveLocalBroadcasts([]);
  showToast('Demo posts cleared');
}

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const screenButton = event.target.closest('[data-screen]');
    if (screenButton) {
      switchScreen(screenButton.dataset.screen);
      return;
    }

    const readButton = event.target.closest('[data-read-id]');
    if (readButton) {
      await markRead(readButton.dataset.readId);
    }
  });

  els.adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = els.adminEmail.value.trim();
    const password = els.adminPassword.value;

    if (hasBackendConfig()) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        showToast('Login failed');
        return;
      }
      currentAdminUser = data?.user || null;
      await verifyAdminSession();
      if (!isAdminUnlocked()) {
        await supabaseClient.auth.signOut();
        showToast('This email is not approved as admin');
        return;
      }
      showToast('Admin unlocked');
      renderAdminState();
      return;
    }

    if (email.toLowerCase() === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      showToast('Admin unlocked');
      return;
    }

    showToast('Incorrect demo login');
  });

  els.resetPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = els.resetEmail.value.trim();

    if (hasBackendConfig()) {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: CONFIG.PASSWORD_RESET_REDIRECT,
      });
      if (error) {
        showToast('Could not send reset email');
        return;
      }
      showToast('Reset email sent');
      showLoginForm(false);
      return;
    }

    showToast('Demo mode: connect Supabase to send reset emails');
    showLoginForm(false);
  });

  els.newPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = els.newPassword.value;

    if (!hasBackendConfig()) {
      showToast('Connect Supabase to update password');
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      showToast('Could not update password');
      return;
    }

    passwordRecoveryMode = false;
    showToast('Password updated');
    await verifyAdminSession();
    renderAdminState();
  });

  els.broadcastForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(els.broadcastForm);
    const title = String(formData.get('title') || '').trim();
    const body = String(formData.get('body') || '').trim();
    const priority = String(formData.get('priority') || 'general');

    if (!title || !body) {
      showToast('Add a title and message');
      return;
    }

    try {
      await createBroadcast({ title, body, priority });
      els.broadcastForm.reset();
      els.broadcastForm.querySelector('input[name="priority"][value="important"]').checked = true;
      showToast('Broadcast sent');
      switchScreen('posts');
    } catch (error) {
      console.error('Could not send broadcast', error);
      showToast('Could not send broadcast');
    }
  });

  els.showResetBtn.addEventListener('click', showResetForm);
  els.backToLoginBtn.addEventListener('click', () => showLoginForm());

  els.lockAdminBtn.addEventListener('click', async () => {
    if (hasBackendConfig()) await supabaseClient.auth.signOut();
    setAdminUnlocked(false);
    showToast('Admin locked');
  });

  els.seedBtn.addEventListener('click', seedDemoPosts);
  els.clearBtn.addEventListener('click', clearDemoPosts);

  window.addEventListener('hashchange', () => {
    const screen = window.location.hash.replace('#', '') || 'welcome';
    if (document.querySelector(`#screen-${screen}`)) switchScreen(screen);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderInstallSteps();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('PFM Broadcasts installed');
    renderInstallSteps();
  });

  async function promptInstall() {
    if (!deferredInstallPrompt) {
      renderInstallSteps();
      switchScreen('install');
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    renderInstallSteps();
  }

  els.installBtn.addEventListener('click', promptInstall);
  els.installFromWelcomeBtn.addEventListener('click', promptInstall);

  if (localChannel) {
    localChannel.addEventListener('message', (event) => {
      if (event.data?.type === 'broadcasts-updated' && !hasBackendConfig()) {
        cachedBroadcasts = getLocalBroadcasts();
        render();
      }
    });
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}

async function startApp() {
  bindEvents();
  await initBackend();
  render();

  const initialScreen = window.location.hash.replace('#', '') || 'welcome';
  if (document.querySelector(`#screen-${initialScreen}`)) switchScreen(initialScreen);

  await registerServiceWorker();
}

startApp();

```

## `manifest.webmanifest`

```json
{
  "id": "/",
  "name": "PFM Broadcasts",
  "short_name": "PFM",
  "description": "Simple installable broadcasting app for Professional Field Marketing.",
  "lang": "en-ZA",
  "dir": "ltr",
  "start_url": "./?source=pwa",
  "scope": "./",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "background_color": "#ffffff",
  "theme_color": "#001c52",
  "orientation": "portrait-primary",
  "categories": ["business", "productivity", "utilities"],
  "prefer_related_applications": false,
  "icons": [
    { "src": "icons/icon-72.png", "sizes": "72x72", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-96.png", "sizes": "96x96", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-128.png", "sizes": "128x128", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-144.png", "sizes": "144x144", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-152.png", "sizes": "152x152", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-180.png", "sizes": "180x180", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-384.png", "sizes": "384x384", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/maskable-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/maskable-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Posts",
      "short_name": "Posts",
      "description": "Open PFM broadcast posts",
      "url": "./#posts",
      "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" }]
    },
    {
      "name": "Install App",
      "short_name": "Install",
      "description": "Show install instructions",
      "url": "./#install",
      "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" }]
    }
  ]
}

```

## `sw.js`

```javascript
const CACHE_NAME = 'pfm-broadcasts-pwa-v5';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './assets/pfm-logo-full.png',
  './assets/pfm-logo-lockup.png',
  './assets/pfm-mark.png',
  './assets/pfm-mark-wide.png',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/maskable-icon-192.png',
  './icons/maskable-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});

```

## `vercel.json`

```json
{
  "headers": [
    {
      "source": "/manifest.webmanifest",
      "headers": [
        { "key": "Content-Type", "value": "application/manifest+json; charset=utf-8" },
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Service-Worker-Allowed", "value": "/" },
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    },
    {
      "source": "/icons/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}

```

## `supabase/schema.sql`

```sql
-- PFM Broadcasts Supabase schema
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 700),
  priority text not null default 'general' check (priority in ('urgent', 'important', 'general')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.broadcast_reads (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 120),
  read_at timestamptz not null default now(),
  unique (broadcast_id, device_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists broadcasts_touch_updated_at on public.broadcasts;
create trigger broadcasts_touch_updated_at
before update on public.broadcasts
for each row execute function public.touch_updated_at();

create or replace function public.is_pfm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.is_admin = true
  );
$$;

alter table public.admin_profiles enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_reads enable row level security;

-- Admin profile policies
create policy "Admins can read admin profiles"
on public.admin_profiles
for select
to authenticated
using (public.is_pfm_admin() or user_id = auth.uid());

create policy "Admins can manage admin profiles"
on public.admin_profiles
for all
to authenticated
using (public.is_pfm_admin())
with check (public.is_pfm_admin());

-- Broadcast policies
create policy "Anyone can read active broadcasts"
on public.broadcasts
for select
to anon, authenticated
using (is_active = true);

create policy "Admins can create broadcasts"
on public.broadcasts
for insert
to authenticated
with check (public.is_pfm_admin());

create policy "Admins can update broadcasts"
on public.broadcasts
for update
to authenticated
using (public.is_pfm_admin())
with check (public.is_pfm_admin());

create policy "Admins can delete broadcasts"
on public.broadcasts
for delete
to authenticated
using (public.is_pfm_admin());

-- Read receipt policies
-- The public app only stores a generated device id, not personal user data.
create policy "Anyone can mark a broadcast as read"
on public.broadcast_reads
for insert
to anon, authenticated
with check (device_id is not null and char_length(device_id) between 8 and 120);

create policy "Anyone can view read receipts"
on public.broadcast_reads
for select
to anon, authenticated
using (true);

create policy "Anyone can update own read receipt row through upsert"
on public.broadcast_reads
for update
to anon, authenticated
using (true)
with check (device_id is not null and char_length(device_id) between 8 and 120);

-- Realtime setup.
-- If Supabase says the table is already in the publication, ignore that duplicate notice.
alter publication supabase_realtime add table public.broadcasts;
alter publication supabase_realtime add table public.broadcast_reads;

-- After creating your first Supabase Auth user, run this with that user's UUID:
-- insert into public.admin_profiles (user_id, full_name, is_admin)
-- values ('PASTE-AUTH-USER-UUID-HERE', 'PFM Admin', true)
-- on conflict (user_id) do update set is_admin = true;

```

## `README.md`

```markdown
# PFM Broadcasts

A mobile-first installable PWA for simple company broadcasts.

## Public user flow

```text
Welcome -> Posts -> I have read this
```

## Admin flow

```text
Small top-right Admin button -> Email/password -> Broadcast Center -> Send Broadcast
```

## Run locally

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## Demo login

Only used when Supabase is not configured.

```text
Email: admin@pfm.co.za
Password: PFM2026!
```

## Production backend

This build is Supabase-ready.

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Create an admin user in Supabase Auth.
4. Add that user's UUID to `admin_profiles`.
5. Add Supabase URL and anon key in `app.js`.
6. Deploy to Vercel or another HTTPS host.

Full instructions are in `BACKEND_GUIDE.md`.

## PWA install

Android:

```text
Open HTTPS app URL in Chrome -> Install app / Add to Home screen
```

iPhone:

```text
Open HTTPS app URL in Safari -> Share -> Add to Home Screen
```

## Files

```text
index.html              Main mobile-first app and styling
app.js                  App logic, Supabase integration, install handling
manifest.webmanifest    PWA metadata and icons
sw.js                   Offline shell service worker
vercel.json             Deployment headers
supabase/schema.sql     Backend database and RLS setup
BACKEND_GUIDE.md        Production backend build guide
FULL_COPY_PASTE_CODE.md Full copy-paste code reference
```

```

## `BACKEND_GUIDE.md`

```markdown
# PFM Broadcasts - Backend Build Guide

## 1. What this app is

PFM Broadcasts is a mobile-first PWA with a simple public flow:

```text
Welcome -> Posts
```

Admin access is deliberately quiet and sits in the top-right corner:

```text
Admin button -> Email/password login -> Broadcast Center -> Send Broadcast
```

When connected to Supabase, the app becomes live across devices:

```text
Admin sends broadcast
      ↓
Supabase Auth checks admin
      ↓
Broadcast saved to database
      ↓
Supabase Realtime notifies every open app
      ↓
Android/iPhone/Desktop app instances refresh their Posts screen
```

## 2. Recommended production stack

Use this stack first because it is fast, affordable, and practical:

| Layer | Recommendation | Reason |
|---|---|---|
| Frontend | Current HTML/CSS/JS PWA | Simple, fast, low maintenance |
| Hosting | Vercel | HTTPS, easy deploy, good for PWA |
| Auth | Supabase Auth | Email/password + forgot password |
| Database | Supabase Postgres | Stores broadcasts and read receipts |
| Realtime | Supabase Realtime | Pushes new broadcasts to open app instances |
| Mobile install | Browser PWA install | Android Chrome install + iPhone Safari Add to Home Screen |

## 3. Database structure

### `broadcasts`
Stores every broadcast post.

Important columns:

- `title`
- `message`
- `priority`
- `created_by`
- `created_at`
- `is_active`

### `broadcast_reads`
Stores that a specific device has read a broadcast.

Important columns:

- `broadcast_id`
- `device_id`
- `read_at`

This does not need field-worker logins. The public user simply gets a generated device ID stored in the browser.

### `admin_profiles`
Controls who is allowed to post.

Important columns:

- `user_id`
- `is_admin`

A person must have a Supabase Auth account and an `admin_profiles` row with `is_admin = true`.

## 4. Supabase setup steps

### Step 1 - Create Supabase project

Create a new Supabase project.

### Step 2 - Run SQL

Open Supabase SQL Editor and run:

```text
supabase/schema.sql
```

### Step 3 - Create admin account

In Supabase Dashboard:

```text
Authentication -> Users -> Add user
```

Create the admin email and password.

### Step 4 - Approve the admin

Copy the Auth user UUID and run this in SQL Editor:

```sql
insert into public.admin_profiles (user_id, full_name, is_admin)
values ('PASTE-AUTH-USER-UUID-HERE', 'PFM Admin', true)
on conflict (user_id) do update set is_admin = true;
```

### Step 5 - Enable password reset email

In Supabase:

```text
Authentication -> URL Configuration
```

Set the site URL to your deployed app URL.

Example:

```text
https://pfm-broadcasts.vercel.app
```

Add redirect URLs:

```text
https://pfm-broadcasts.vercel.app/#admin
http://localhost:8080/#admin
```

### Step 6 - Add credentials to app.js

Open `app.js` and fill in:

```js
const CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-SUPABASE-ANON-KEY',
  PASSWORD_RESET_REDIRECT: `${window.location.origin}${window.location.pathname}#admin`,
};
```

Never place the service-role key in front-end code.

## 5. Local testing

From the project folder:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Test:

1. Welcome loads.
2. Posts loads.
3. Logo images appear.
4. Admin button opens login.
5. Admin can log in.
6. Admin can send a broadcast.
7. Broadcast appears in Posts.
8. Open a second browser tab and confirm it updates.
9. On Android, open the hosted HTTPS link in Chrome and test install.

## 6. Deploy to Vercel

### Option A - Upload folder to GitHub

1. Create GitHub repo.
2. Add all files.
3. Connect repo to Vercel.
4. Deploy.

### Option B - Vercel CLI

```bash
npm i -g vercel
vercel
vercel --prod
```

## 7. Android install requirements

For Android install testing, the app must be served through HTTPS or localhost. A normal `file://` open will not properly test PWA install.

The app already includes:

- `manifest.webmanifest`
- `sw.js`
- Android icons
- maskable icons
- install prompt handling
- mobile viewport settings
- standalone display mode

## 8. iPhone install

On iPhone:

```text
Safari -> open app URL -> Share -> Add to Home Screen
```

The app already includes:

- Apple mobile web app meta tags
- Apple touch icon
- safe-area layout support

## 9. How the backend works in plain English

### Public user

The public user does not need to log in.

The app:

1. Opens from browser or home screen.
2. Generates a private local device ID.
3. Loads active broadcasts from Supabase.
4. Shows posts in priority/date order.
5. Saves read acknowledgements against that device ID.

### Admin

The admin:

1. Taps the small Admin button.
2. Logs in with email and password.
3. Supabase Auth checks the password.
4. The app checks `admin_profiles` to confirm the user is approved.
5. Approved admin can send broadcasts.
6. Supabase saves the broadcast.
7. Realtime notifies other open app instances.

### Forgot password

The admin:

1. Taps Forgot password.
2. Enters email.
3. Supabase sends a reset email.
4. Admin clicks the email link.
5. App opens Admin screen.
6. Admin sets a new password.

## 10. Production improvements for later

Do these after the MVP works:

- Admin dashboard showing read/unread counts.
- Archive old broadcasts instead of deleting.
- Push notifications.
- Admin activity log.
- Brand-controlled app domain.
- Multiple admin roles.
- Optional department targeting.
- Offline queued read receipts.

## 11. Current project structure

```text
fmcg-merch-pwa/
  index.html
  app.js
  manifest.webmanifest
  sw.js
  vercel.json
  README.md
  BACKEND_GUIDE.md
  PRODUCT_CANVAS.md
  FULL_COPY_PASTE_CODE.md
  assets/
    pfm-logo-full.png
    pfm-logo-lockup.png
    pfm-mark.png
    pfm-mark-wide.png
  icons/
    icon-72.png
    icon-96.png
    icon-128.png
    icon-144.png
    icon-152.png
    icon-180.png
    icon-192.png
    icon-384.png
    icon-512.png
    apple-touch-icon-180.png
    maskable-icon-192.png
    maskable-icon-512.png
  supabase/
    schema.sql
```

```

## `PRODUCT_CANVAS.md`

```markdown
# PFM Broadcasts - Product Canvas

## Product idea

PFM Broadcasts is a simple broadcasting web app for Professional Field Marketing.

It is not a task-management app and not a merchandiser dashboard. It is focused on one job:

```text
Admin posts once. Everyone sees the broadcast.
```

## Core flow

### Public user

```text
Open app -> Welcome -> Posts -> Read broadcast -> Tap I have read this
```

### Admin

```text
Open app -> Small Admin button -> Email/password -> Broadcast Center -> Send Broadcast
```

## Main screens

| Screen | Purpose |
|---|---|
| Welcome | Brand entry point and install prompt |
| Posts | Broadcast feed |
| Install App | Android/iPhone install instructions |
| Admin Login | Locked email/password access |
| Broadcast Center | Admin creates and sends broadcasts |

## Design rules

- Mobile first.
- Use the PFM blue and yellow identity.
- Keep the Admin button available but quiet.
- Avoid complicated dashboards.
- Avoid role selectors.
- Avoid merchandiser-specific wording.
- Use large buttons and readable text.
- Make the public app usable with minimal training.

## Backend model

```text
Supabase Auth
  -> Admin email/password and forgot password

admin_profiles
  -> Controls who can post

broadcasts
  -> Stores posts

broadcast_reads
  -> Stores device-level acknowledgement

Supabase Realtime
  -> Updates open app instances when broadcasts change
```

## MVP success criteria

- Users can install the app from Android Chrome.
- iPhone users can add it through Safari.
- Public users can read posts without login.
- Admins can log in with email/password.
- Admins can reset password through email.
- Admins can publish broadcasts.
- Broadcasts update across devices once backend is connected.
- The app works well on mobile and remains usable on desktop.

```
