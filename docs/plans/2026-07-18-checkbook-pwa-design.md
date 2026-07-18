# Checkbook Ledger PWA — Design

Date: 2026-07-18
Status: Approved (full-execution build)

## Goal

Recreate the iOS "Checkbook - Account Tracker" app as an installable PWA using
Firebase Auth and Cloud Firestore, following the designer's hi-fi mockups
(`Checkbook Ledger.dc.html` in the "Personal Checkbook Ledger App" Claude Design
project). Where the design and these requirements conflict, requirements win;
the design supplies the UI and design system.

## Decisions

- **Stack**: Vite + React + TypeScript PWA (replaces the blank Expo scaffold).
- **Auth**: Firebase Auth with Google and email/password (+ password reset).
- **Data**: Cloud Firestore, per-user subtree, offline persistence enabled.
- **Import**: Settings screen importing the old Realm export (JSON/CSV).
- **Recurring**: out of scope for v1 (toggle hidden).
- **Firebase project**: `checkbook-713a4` ("checkbook").

## Product scope (v1)

- Multiple accounts with name + opening balance; account switcher; archive.
- Register per account: Outstanding / Cleared sections, month navigation,
  per-row running balance, Balance / Cleared / Outstanding summary header,
  hide-cleared toggle, search, FAB add, empty state ("Set opening balance").
- Transactions: expense | income | transfer; amount; payee with frequent-payee
  suggestion chips; category from a fixed built-in list (with icons); date;
  optional check # and memo; cleared flag. Edit and delete.
- Transfers: destination account picker; one document, shown in both
  registers; neutral ink + paired-arrow glyph, no sign (per design 1e).
- Payees: auto-created on save; cache default category (pre-fill) and use
  count (ranks suggestions). Transactions store payeeId AND payeeName,
  fixing the Realm schema's name-text-only linkage.
- Reconcile (design 1c): statement ending balance, check off items, live
  difference remaining + progress, "Balanced to the penny" state; finish
  stamps cleared/reconciledAt.
- Batch select (design 2a): multi-select outstanding rows, live total,
  "Mark cleared" or hand off to Reconcile.
- PWA: manifest, service worker (vite-plugin-pwa), installable, offline via
  Firestore persistent local cache. Light + dark theme per design.

## Firestore data model

All app data under `users/{uid}`; rules allow access only when
`request.auth.uid == uid`.

```
users/{uid}
  profile fields: email, displayName, currency ("USD"), settings{theme, hideCleared}
  accounts/{accountId}:   name, openingBalanceCents, archived, sortOrder, createdAt
  payees/{payeeId}:       name, nameLower, defaultCategoryId, useCount, lastUsedAt
  transactions/{txnId}:   accountId, type: "expense"|"income"|"transfer",
                          amountCents (positive int; sign derived from type),
                          payeeId?, payeeName, categoryId,
                          date (Timestamp), checkNumber?, memo?,
                          cleared, clearedAt?, reconciledAt?,
                          transferAccountId? (transfers only),
                          createdAt, updatedAt
```

Rationale:

- **Integer cents** everywhere; the Realm floats are unacceptable for a ledger.
- **Categories hardcoded in-app** (the original's category table was empty —
  names were app constants copied onto rows). Transactions store `categoryId`;
  display resolves from the app's list. Unknown ids (from import) fall back to
  a generic category while preserving the original name in `categoryName`.
- **No stored running balance** — total/cleared/outstanding and per-row running
  balances are computed client-side from the snapshot stream (~7k docs is
  trivial; eliminates the drift-prone `nowBalance`).
- **Transfers are one doc**: `accountId` = source, `transferAccountId` =
  destination. Registers query `or(accountId == X, transferAccountId == X)`.
  Amount displays negative on the source register, positive on destination.

## Architecture

- Firebase JS SDK (modular): Auth + Firestore with `persistentLocalCache`
  (multi-tab). `onSnapshot` subscriptions wrapped in hooks; React context for
  auth/user/account selection; no external state library.
- Routing: React Router — `/signin`, `/` (register), transaction sheet
  (new/edit), `/reconcile`, batch-select mode, `/accounts`, `/payees`,
  `/settings` (+ import).
- Styling: plain CSS with custom-property tokens lifted from the design's
  component sheet (colors, radii, type scale; Source Sans 3 with tabular
  numerals). Dark theme via `data-theme` attribute + system preference.
- Pure ledger logic (`src/lib/ledger.ts`, `money.ts`, `import.ts`) kept free of
  Firebase/React so Vitest covers it directly.
- Import: parses Realm JSON/CSV export, maps to schema above (amounts to
  cents, epoch seconds to Timestamps, payee matching by name creating payee
  docs), writes in ≤500-op batches with progress UI.

## Error handling

- Firestore writes are optimistic (local cache); failures surface as a toast.
- Auth errors mapped to friendly messages on the sign-in form.
- Import validates before writing: row-level errors collected and reported,
  nothing partial-committed within a batch.

## Testing & delivery

- Vitest: money formatting/parsing, running-balance math, section grouping,
  reconcile difference, import mapping.
- Browser verification of full flows (add/edit/delete, transfer, reconcile,
  batch clear, import) against the live Firestore project.
- Deploy: Firebase Hosting on `checkbook-713a4`; rules + indexes deployed via
  `firebase deploy`.
