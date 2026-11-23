# CLAUDE.md

ISP manager for شبكة أولاد كشيش (Basra, Zubair): subscribers, renewals, debts, towers, cash.
UI is **Arabic, RTL**. README, chat replies to the owner: **German**. Commit messages: English.

## Workflow
- After every finished piece of work: commit, push and open (or update) the pull request right away, without asking. Don't offer to watch it.

## Save tokens
- Never read `package-lock.json`, `dist/`, `dist-preview/`, `.wrangler/`, `node_modules/`.
- `src/App.tsx` (~1600 lines) and the views are big: `grep -n` first, then read only the needed line range.
- Don't re-read a file after editing it. (Preview build forces the admin user; to test other roles temporarily patch `previewAdmin` in App.tsx and revert.) Batch edits per file.
- Check with `npm run lint` (tsc for app + worker), `npm test` (vitest, money math) and `npm run build`. CI runs all three.
- Browser check only when UI changed: `VITE_PREVIEW_MODE=true npx vite build --outDir <tmp>` then
  `npx vite preview --outDir <tmp>` (works without server, no login, empty data — seed localStorage key
  `sas_plus_subscribers_kashish_v1`).

## Layout
- Navigation: 5 sections in `src/components/nav.ts` (`NAV_GROUPS`: الرئيسية, المشتركون, المال = debts/cash/reports/dashboard,
  التسويق = marketing/reminders, المزيد = more page + tickets/towers/providers/users/settings). Pages (tabs) are unchanged and
  keep their access rules; a new page needs an entry in a group, `TAB_LABEL` and `TAB_ACCESS`. `SubNav` (in Header) shows the pages
  of the active section. Start page = `HomeView` (3 numbers + one "today" list from pure `utils/today.ts`); `MoreView` holds device
  and account actions (simple mode, bell, install, Excel, switch user, logout) via `hooks/useDeviceActions`.
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
- Sessions/notifications: login has "remember this device" (`isRemembered` in `sync/api.ts`, localStorage). Remembered =
  60-day server session that renews on use (`authenticate` in worker) and **no idle lock**; otherwise 24 h + page-session
  + 60 min idle lock. Background notifications = Web Push without a payload: `worker/push.ts` (daily cron in
  `wrangler*.jsonc`, VAPID keys auto-created in `meta`, table `push_subs`), `shared/digest.ts` (counts only, no names) and
  `shared/vapid.ts`; `public/sw.js` fetches `/api/push/digest` on `push`; `src/utils/push.ts` subscribes (bell button).
  Only admin/accountant receive pushes. Bell = `components/NotificationBell.tsx` (popover portaled to body): grouped
  «now» alerts from pure `utils/alerts.ts` (one line per kind, not per subscriber) + log of every `notify()` in
  `utils/notificationCenter.ts` (device-local, merges repeats) + device-push row. Toasts: max 2, no duplicates. Local test: `wrangler dev --test-scheduled`, trigger `/cdn-cgi/handler/scheduled?cron=...`.
- Marketing tab `views/MarketingView.tsx` (offers in `settings.promotions`, admin edits; WhatsApp campaigns by segment with
  daily limit + 7-day cool-down, device-local history; referrals). Pure logic: `utils/marketing.ts` (segments lost/loyal/
  upgrade/tower, `pendingReferrals`, `referralBoard`, `fillTemplate`). Subscriber fields `referredBy`, `referralRewarded`,
  `noMarketing` (opt-out, also excluded from campaigns). Renewal dialog shows offers + upsell hint + referral bonus days.
- Marketing plan (first tab «التخطيط»): `utils/marketingPlan.ts` = readable idea library (`ACTION_IDEAS`, Arabic texts),
  `upcomingOccasions` (Ramadan/Eids via `Intl` islamic-umalqura, approximate; school start fixed), plan items in
  `settings.marketingPlan` (admin edits). Adding an offer idea can create a dated, linked promotion. Header badge =
  `planAlertCount` (items starting within 3 days).
- Year plan: `buildYearPlan(year)` / `missingYearPlan` (items carry `templateKey`, starts with December of the previous year).
  Offer kind `new_price` (`planPrices`, first month only, new subscribers only, never at renewal): `newCustomerDiscount`/
  `bestNewCustomerOffer` in `shared/promotions.ts`; `SubscriberModal` stores `cycleDiscount`+`cyclePromotionId`; worker
  `newCustomerViolation` checks non-admin creates. Subscriber field `switchedFrom` = came from a competitor.
- `shared/access.ts` — roles, tab access, collection rules (`COLLECTION_RULES`, `HIDDEN_FROM`). Used by UI **and**
  worker; edit only here. Don't import from `src`/`worker` in it.
- `src/components/views/*View.tsx` — one per tab; `SimpleHomeView` = simple mode home.
- Subscriber rows: only «تجديد», WhatsApp and «⋯» (`RowMenu` in `SubscribersView`: profile, debt, history, edit, receipt, ticket, delete). Keep new
  per-subscriber actions in that menu. Dashboard: no lists that exist elsewhere (urgent → Home, debtors → Debts, towers → Towers); empty cards are hidden.
- Labels are Arabic only (no «(Overdue)»/«(Paid)» in the UI).
- `src/components/*Modal.tsx`, `SubscriberProfile.tsx`, `QuickSearch.tsx`, `Header.tsx` (tabs, mobile bottom nav).
- `src/components/ui/` — `Dialogs.tsx` (`appConfirm`, `notify` instead of confirm/alert), `overlayExit.ts`, `CountUp`, `ViewLoader`,
  `BackButton` ("رجوع" in every dialog header), `backStack.ts` + `useEscapeKey` (Escape / phone back closes the top dialog;
  back with no dialog goes to the previous tab).
- `src/utils/storage.ts` — localStorage load/save, money math (`getAmountDue`, `getRemainingDebt`), formatting, WhatsApp, Excel.
- `src/utils/debt.ts` (months-based debt), `installments.ts` (plans), `search.ts` (Arabic-tolerant search), `dates.ts` (local dates, `todayStr`).
- `src/sync/` — offline-first sync: local data + shadow copy, push diffs / pull by cursor to `/api/sync`.
- `worker/index.ts` — Cloudflare Worker + D1: auth (PBKDF2), roles, sync, audit log. `worker/advisor.ts` — AI advisor. UI = floating button bottom-right `components/AdvisorFab.tsx` (lazy `AdvisorPanel` in `views/AdvisorView.tsx`, chat stays alive when closed; bottom-left is the sync badge; `canUseAdvisor` in `shared/access.ts`). It is no page/tab anymore.
- `desktop/` — Electron shell that only loads the hosted URL.
- Deploy: push to `main` → GitHub Action → `wrangler deploy`.

## Domain rules (don't break)
- Debt = `salePrice × cycleMonths + carriedDebt − cycleDiscount − paidAmount`. Offers: free months go into `cycleMonths`
  (longer expiry) and their value into `cycleDiscount`; never lower debt any other way. Rules in `shared/promotions.ts`
  (UI and worker); the worker rejects non-admin renewals whose discount does not match an offer, or that drop old debt. Payments only via receipts (`PaymentRecord`);
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
  Blur only on header, bottom nav and dialogs (performance). One glass surface for all windows (`--glass-*` vars:
  every `.app-overlay > *`, `.glass-popover`, `.glass-toast`); don't give dialogs their own border colors/radius. Primary `bg-cyan/emerald/indigo-600|700` buttons get gradients.
- Color meaning: cyan = brand/primary, rose = expired/danger only, amber = expiring soon or debt, emerald = active/paid.
  Show a status color once per row (pill), keep avatars/secondary buttons neutral. Logout is neutral with a rose icon.
- Sizes: everything is rem. Type tokens (`--text-xs..2xl`) and tiny `text-[10/11px]` are raised in `index.css` ("مقياس الخط"); touch devices get 44px min tap targets. The user picks the root scale (4 steps, device-local) in «المزيد» (`utils/uiScale.ts`, applied in `main.tsx`). Don't use fixed px sizes for text or controls.
- Motion: transform/opacity only, honor `prefers-reduced-motion` (already global in `index.css`).
