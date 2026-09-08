# Entry form, register scroll, and Insights filters — design

Date: 2026-09-08. Seven refinements to the shipped app, approved together.

## Entry form

Field order for expense/income becomes: type segments → **Payee card** →
**Amount card** → detail rows. The payee card matches the amount card's
prominence: an eyebrow label, a large centered input, and the suggestion
chips beneath it. New transactions autofocus the payee. Transfers have no
payee, so the amount card stays first there and keeps autofocus.

Payee text is title-cased as you type: `titleCase()` in `src/lib/text.ts`
uppercases the first letter of each word and leaves everything else alone,
so "mcdonald's coffee" → "Mcdonald's Coffee" and a deliberate "McDonald's"
survives. The input also sets `autoCapitalize="words"` for mobile keyboards.

## Categories

Add `cat_ccpayment` — Credit Card Payment 💳, kind expense. (Paycheck
already existed.)

## Register: continuous month scroll

The register no longer filters to one month. It renders every transaction,
newest first, grouped into one card per month with a divider label above
each card. Rendering is incremental: a fixed batch of rows at a time, with
an IntersectionObserver sentinel near the bottom that extends the batch —
scrolling out of September flows straight into August.

The month label in the filter row live-updates to the month group nearest
the top of the viewport (scroll listener over the divider positions) —
that's the visual indicator that the month shifted. The ‹ › buttons now
jump-scroll to the previous/next month group that actually exists.
"Hide cleared", search, staging, and reconcile are unchanged; the old
"uncleared always visible across months" rule dissolves because every
month is reachable in the one list.

Opening a transaction saves `{txnId, scrollY, renderCount}` per account in
sessionStorage; returning to the register restores the render depth and
scroll position and briefly highlights the row you left from.

## Insights: date ranges and drill-down

The period lives in the URL: `?y=&m=` for month mode, `?from=&to=`
(yyyy-mm-dd) for range mode — so navigating away and back keeps it.
A filter chip opens a sheet with presets (This month, Last 3 months,
Last 6 months, Year to date, This year) and custom From/To pickers.
Range mode shows the range label with an × to return to month mode.

`src/lib/insights.ts` generalizes from (year, month) to a half-open
`DateRange` (`src/lib/dates.ts`: `monthRange`, `inRange`, `rangeLabel`).
The cash-flow card totals the whole range; the 6-month trend stays
anchored to the range's final month. Transfers stay excluded.

Tapping a category row pushes `/insights/category?cat=&label=…` plus the
period params: a full-screen list of that category's expenses in the
period, count and total at the top, each row opening the edit form.

## Tests

New coverage: `titleCase`, range-based insights math, and the register
month-grouping helper (`monthGroups` in `src/lib/ledger.ts`). Existing
insights tests move to the range signatures.
