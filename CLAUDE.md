# CLAUDE.md

ISP manager for شبكة أولاد كشيش (Basra, Zubair): subscribers, renewals, debts, towers, cash.
UI is **Arabic, RTL**. README, chat replies to the owner: **German**. Commit messages: English.

## Save tokens
- Never read `package-lock.json`, `dist/`, `dist-preview/`, `.wrangler/`, `node_modules/`.
- `src/App.tsx` (~1700 lines) and the views are big: `grep -n` first, then read only the needed line range.
- Don't re-read a file after editing it. Batch edits per file.
- Check with `npm run lint` (tsc for app + worker) and `npm run build`. No test suite exists.
- Browser check only when UI changed: `VITE_PREVIEW_MODE=true npx vite build --outDir <tmp>` then
  `npx vite preview --outDir <tmp>` (works without server, no login, empty data — seed localStorage key
  `sas_plus_subscribers_kashish_v1`).

## Layout
- `src/App.tsx` — all app state, handlers (`handleAddPayment`, `handleConfirmRenewal`, `handleAdjustDebt`, …),
  tab routing (`TAB_ACCESS`), simple mode, modals. Views receive data + callbacks as props.
- `src/components/views/*View.tsx` — one per tab; `SimpleHomeView` = simple mode home.
- `src/components/*Modal.tsx`, `SubscriberProfile.tsx`, `QuickSearch.tsx`, `Header.tsx` (tabs, mobile bottom nav).
- `src/components/ui/` — `Dialogs.tsx` (`appConfirm`, `notify` instead of confirm/alert), `overlayExit.ts`, `CountUp`, `ViewLoader`.
- `src/utils/storage.ts` — localStorage load/save, money math (`getAmountDue`, `getRemainingDebt`), formatting, WhatsApp, Excel.
- `src/utils/debt.ts` (months-based debt), `installments.ts` (plans), `search.ts` (Arabic-tolerant search), `dates.ts` (local dates, `todayStr`).
- `src/sync/` — offline-first sync: local data + shadow copy, push diffs / pull by cursor to `/api/sync`.
- `worker/index.ts` — Cloudflare Worker + D1: auth (PBKDF2), roles, sync, audit log. `worker/advisor.ts` — AI advisor.
- `desktop/` — Electron shell that only loads the hosted URL.
- Deploy: push to `main` → GitHub Action → `wrangler deploy`.

## Domain rules (don't break)
- Debt = `salePrice × cycleMonths + carriedDebt − paidAmount`. Payments only via receipts (`PaymentRecord`);
  never edit `paidAmount` directly in a form. Partial payments: `handleAddPayment` adds to `paidAmount`.
- Renewal carries unpaid debt into `carriedDebt`. Only admin may lower debt (`handleAdjustDebt`, logged in `debtLog`);
  the server rejects a `paidAmount` increase not covered by payment records in the same push.
- Roles: `admin`, `accountant`, `technician`. Technicians see no money and cannot renew. Enforce in UI **and** worker `RULES`.
- Archived subscribers (`archived`) are excluded from lists/stats (`activeSubscribers` in App).

## UI conventions
- Tailwind 4 classes, dark slate theme. Overlays: root div gets `app-overlay` (animations are automatic).
- Simple mode (default per user/device): big labeled buttons, ≥16px text. Keep new features reachable from
  `SubscriberProfile` instead of adding buttons to the simple list.
- Labels visible on inputs; buttons start with a verb; Arabic number/day forms (`formatMonthsAr`, `daysAr`).
- Motion: transform/opacity only, honor `prefers-reduced-motion` (already global in `index.css`).
