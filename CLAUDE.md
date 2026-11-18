# CLAUDE.md

ISP manager for شبكة أولاد كشيش (Basra, Zubair): subscribers, renewals, debts, towers, cash.
UI is **Arabic, RTL**. README, chat replies to the owner: **German**. Commit messages: English.

## Save tokens
- Never read `package-lock.json`, `dist/`, `dist-preview/`, `.wrangler/`, `node_modules/`.
- `src/App.tsx` (~1600 lines) and the views are big: `grep -n` first, then read only the needed line range.
- Don't re-read a file after editing it. (Preview build forces the admin user; to test other roles temporarily patch `previewAdmin` in App.tsx and revert.) Batch edits per file.
- Check with `npm run lint` (tsc for app + worker), `npm test` (vitest, money math) and `npm run build`. CI runs all three.
- Browser check only when UI changed: `VITE_PREVIEW_MODE=true npx vite build --outDir <tmp>` then
  `npx vite preview --outDir <tmp>` (works without server, no login, empty data — seed localStorage key
  `sas_plus_subscribers_kashish_v1`).

## Layout
- `src/App.tsx` — app state, thin handlers (set state + notify), tab routing, simple mode, modals. Views are
  `React.lazy` (`viewLoaders`, preloaded when idle) and receive data + callbacks as props.
- `src/utils/ledger.ts` — **pure money functions** (`buildRenewal`, `buildPayment`, `applyDebtAdjustment`,
  `reversePayment`). Change money behavior here and add a case in `src/utils/__tests__/ledger.test.ts`.
- `src/utils/undo.ts` + `src/hooks/useUndo.ts` + `components/UndoBar.tsx` — admin-only undo. Call `beginUndo('label')`
  as the first line of **every handler that changes subscribers/payments/tickets/providers/towers/expenses**; the hook
  diffs before/after and stores only the changed records (settings and staff users are not covered).
- `src/utils/debtBoard.ts` (pure: ranking, promise/plan/cool-down states, suggested amount, summary) + `views/DebtsView.tsx`
  (debts tab: 3 buttons per debtor: طالب / سدّد / وعد). `reminders.ts` builds WhatsApp text. Subscriber fields
  `promiseDate`/`promiseSetAt` hold a promise-to-pay; a later payment cancels it. Reminder history is device-local
  (`sas_plus_debt_reminded_v1`). `RemindersView` is now renewals only.
- `shared/access.ts` — roles, tab access, collection rules (`COLLECTION_RULES`, `HIDDEN_FROM`). Used by UI **and**
  worker; edit only here. Don't import from `src`/`worker` in it.
- `src/components/views/*View.tsx` — one per tab; `SimpleHomeView` = simple mode home.
- `src/components/*Modal.tsx`, `SubscriberProfile.tsx`, `QuickSearch.tsx`, `Header.tsx` (tabs, mobile bottom nav).
- `src/components/ui/` — `Dialogs.tsx` (`appConfirm`, `notify` instead of confirm/alert), `overlayExit.ts`, `CountUp`, `ViewLoader`,
  `BackButton` ("رجوع" in every dialog header), `backStack.ts` + `useEscapeKey` (Escape / phone back closes the top dialog;
  back with no dialog goes to the previous tab).
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
- Roles: `admin`, `accountant`, `technician`. Technicians see no money and cannot renew. Rules live in `shared/access.ts`.
- Subscriber usernames (PPPoE) are **case-sensitive** (`Ali` ≠ `ali`): never `.toLowerCase()` them for comparing or storing.
  Search uses smart case (`search.ts`: a capital letter in the query = exact username); import dedupe is `importDedupe.ts`.
  Username/search/password inputs need `autoCapitalize="none" autoCorrect="off" spellCheck={false}`. Names stay
  tolerant (`normalizeNameKey`). Staff login names are case-insensitive on purpose (D1 `COLLATE NOCASE`).
- Archived subscribers (`archived`) are excluded from lists/stats (`activeSubscribers` in App).

## UI conventions
- Tailwind 4 classes, dark slate theme. Overlays: root div gets `app-overlay` (animations are automatic), call
  `useEscapeKey(onClose)` in the dialog and use `<BackButton>` in its header.
- Simple mode (default per user/device): big labeled buttons, ≥16px text. Keep new features reachable from
  `SubscriberProfile` instead of adding buttons to the simple list.
- Labels visible on inputs; buttons start with a verb; Arabic number/day forms (`formatMonthsAr`, `daysAr`).
- Glass design lives in `src/index.css` ("التصميم الزجاجي"): Tailwind `slate-900/800/700` are redefined as translucent, so
  `bg-slate-900` = glass card, `bg-slate-800` = glass chip/button, `border-slate-700` = soft white border. Don't use
  `text-slate-700..900` outside `.bg-white` paper (it would be translucent). `bg-slate-950` stays opaque (inputs, page).
  Blur only on header, bottom nav and dialogs (performance). Primary `bg-cyan/emerald/indigo-600|700` buttons get gradients.
- Color meaning: cyan = brand/primary, rose = expired/danger only, amber = expiring soon or debt, emerald = active/paid.
  Show a status color once per row (pill), keep avatars/secondary buttons neutral. Logout is neutral with a rose icon.
- Motion: transform/opacity only, honor `prefers-reduced-motion` (already global in `index.css`).
