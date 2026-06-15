# Sprak Site V5

This is a Vite + React version of Sprak with Firebase Auth and Firestore profile/social data.

## What's new in V5

- Expanded the roadmap to 20 German-learning units.
- Every unit now has at least 20 core questions.
- Every unit also gets a Guided Unit Review assignment and an End-of-Unit Checkup boss quiz.
- Removed the English translation shown underneath German vocabulary cards so translation questions no longer give away the answer.
- Curriculum is structured more like real beginner/intermediate German learning: greetings, pronunciation, numbers, articles, pronouns, verbs, questions, negation, food, travel, cases, modals, past tense, future, opinions, school/work, health, culture, and fluency practice.
- Kept the V4 systems: Firestore cloud profiles, usernames/@ handles, social hub, friends, gifts, player search, leaderboard, Marks, shop, cosmetics, lesson feedback, Next button, and correct-answer streaks.

## Local setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Vercel settings

Framework Preset: `Vite`
Build Command: `npm run build`
Output Directory: `dist`
Install Command: `npm install`

## Firebase setup

In Firebase Console:

1. Enable Authentication.
2. Enable Email/Password sign-in.
3. Enable Anonymous sign-in.
4. Create a Firestore Database in production mode.
5. Add your Vercel domain in Authentication → Settings → Authorized domains.

## Firestore rules

Use rules that let signed-in users read public profiles, update their own profile, and manage their own friend request/gift data. If you already used the V4 rules, keep them unless you want stricter production rules later.

