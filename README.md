# Sprak Site V4

This is a Vite + React version of Sprak.

## Deploying

1. Upload this folder to GitHub or import it into Vercel.
2. Vercel settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
3. In Firebase Console → Authentication → Settings → Authorized domains, add your Vercel domain.

## Important: Firestore setup

This version uses Firebase Auth **and Firestore** so usernames, profiles, progress, friends, player search, leaderboards, gifts, cosmetics, and Marks save across devices.

In Firebase Console:

1. Go to **Firestore Database**.
2. Create a database.
3. Start in production or test mode.
4. For quick prototype testing, use rules like this:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

These rules are loose for prototyping. Before a real public launch, tighten them so users can only edit their own profile fields and only write friend requests/gifts in approved ways.

## What changed in V4

- Fixed the Roadmap white screen by adding the missing Roadmap component.
- Added Firestore cloud saves.
- Usernames, @ handles, profiles, XP, Marks, cosmetics, and progress now persist across devices.
- Added real player search by username.
- Added friend requests, accepting friends, friends list, and friend gifts.
- Leaderboard now reads real Firestore users instead of only demo users.
