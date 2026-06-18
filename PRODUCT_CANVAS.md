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
