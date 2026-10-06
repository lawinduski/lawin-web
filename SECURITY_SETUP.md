# Omar Perfume — Security Hardening

This version removes Firebase client SDK access from the browser. The browser talks only to same-origin `/api/*` endpoints.

## Required Vercel environment variables
Set these in Vercel Project Settings → Environment Variables:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIREBASE_WEB_API_KEY
- ADMIN_UID

Use the Firebase service-account private key only as a Vercel server-side environment variable. Do not commit it.

## Admin user
Create/keep one Firebase Authentication Email/Password user. Copy that user's UID into `ADMIN_UID`.
Only that UID is accepted by `/api/auth` and `/api/admin`.

## Firestore rules
Publish `firestore.rules` exactly as supplied. The browser no longer needs Firestore access, so all direct client reads/writes are denied. Firebase Admin SDK on the server bypasses these client rules.

## Important cleanup
The old `settings/main` document may still contain the old `pin` field. It is no longer read or returned by the website. Delete that field from Firestore after deployment if you want the old PIN removed completely.

## What is no longer exposed in browser code
- Firebase API key
- Firebase authDomain/projectId config
- Firebase client SDK
- Admin email/password
- Admin UID
- Firebase service-account credentials
- Admin PIN

The frontend still contains ordinary public website content (product names, prices, public contact links, etc.), because those are intentionally displayed to visitors.
