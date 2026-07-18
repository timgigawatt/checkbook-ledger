# Checkbook Ledger

Personal checkbook/account tracker PWA. Vite + React + TypeScript, Firebase
Auth (Google + email/password) and Cloud Firestore (project `checkbook-713a4`).

- Design doc: `docs/plans/2026-07-18-checkbook-pwa-design.md`
- Money is always integer cents (`amountCents`); never floats.
- All Firestore data lives under `users/{uid}/…`; rules in `firestore.rules`.
- Pure ledger logic lives in `src/lib/` and stays free of React/Firebase so
  Vitest covers it directly (`npm test`).
- Categories are a fixed in-app list (`src/lib/categories.ts`), not a
  Firestore collection.
- `npm run dev` to develop, `npm run build` to type-check + build,
  `firebase deploy` for hosting + rules.
