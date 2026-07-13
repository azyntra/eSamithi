# eSamithi — UI Audit & Enhancement Plan

*Audited: July 2026 (post Phase 2 / Requirements v2.0). Covers every page, modal, component, hook, and the stylesheet in `src/renderer`, plus the API surfaces they depend on.*

---

## Part 1 — Confirmed Bugs

### 🔴 High impact

| # | Bug | Where | Detail |
|---|-----|-------|--------|
| B1 | **Dashboard Refresh button doesn't refresh** | `Dashboard.tsx:33` | `handleRefresh` calls `fetchData()` without `force=true`, so within the 5-minute cache TTL it re-serves the cached stats and still toasts "Dashboard data updated". |
| B2 | **Raw IPC error prefix leaks to users** | Most modals | Server errors surface as `Error invoking remote method 'loans:issue': Error: <msg>`. Only 4 call-sites strip the prefix with a copy-pasted regex (Loans, Wallet, Incomes, Expenses deletes); every other toast shows the raw string. Needs one central cleanup (strip in `ipc-handlers.ts` result or a shared `getErrorMessage()` util). |
| B3 | **No session-expiry handling** | Global | JWT expires after 24h. If the app is left open, every subsequent action fails with "Invalid or expired token" toasts forever — there is no 401 → return-to-login path. User must quit and reopen. |
| B4 | **Stale caches survive logout** | All hooks | `memberCache`, `listCache`, `settingsCache`, `loansCache`, `dashboardCache` are module-level and are not cleared on logout. Logging in as a different user (or after data changes elsewhere) shows the previous session's data for up to 5 minutes. Logout also never calls `apiClient.setToken(null)`. |
| B5 | **User-management API not admin-gated on the server** | `server/routes/users.routes.js` | The Settings → System tab is hidden client-side for non-admins, but the `/users` create/delete endpoints only require *any* valid JWT — a non-admin user could create or delete accounts by calling the API directly. Add a `requireRole('admin')` middleware. |
| B6 | **Deposit / Opening Balance UI visible in Live mode** | `Wallet.tsx`, `AddWalletModal.tsx`, `DepositModal.tsx` | After `migration_completed=true` the server correctly rejects deposits and opening balances, but the buttons/fields still render — users hit an error toast instead of the option simply not being offered. Gate on `settings.migration_completed`. |
| B7 | **Max Loan Limit is entered in cents** | `Settings.tsx` ("Maximum Loan Limit (Rs. Cents)") | A treasurer typing `100000` intends Rs 100,000 but sets Rs 1,000. Everywhere else in the app users type rupees and the code multiplies by 100. Convert this field to rupees (`×100` on save, `÷100` on display). |

### 🟠 Medium impact

| # | Bug | Where | Detail |
|---|-----|-------|--------|
| B8 | **System income/expense types are deletable** | Settings → Income/Expense Types | If a coded type (e.g. `fine`, `funeral_benefit`, `loan_interest`) has no transactions yet, it can be deleted — which silently breaks the adaptive forms and the loan engine's auto-ledger inserts. Block deletion (and renaming) of rows with a non-null `code`, server-side. |
| B9 | **Member search fires a request per keystroke** | `useMembers.ts` | `setSearch` triggers a fetch on every character (cache keys by term, so almost always a miss). Add a 300ms debounce. |
| B10 | **`grace_period_days` setting is dead** | Settings → Loan Engine | Editable in the UI, stored in DB, referenced nowhere in the loan engine. Either implement it (delay the first fine by N days after the interest month boundary) or remove the field. |
| B11 | **"Live Activity" / "Live Monitoring" aren't live** | `Dashboard.tsx` | Data is cached for 5 minutes and there is no polling or push. Either add a lightweight refresh interval or drop the "Live" wording. |
| B12 | **FD ↔ wallet money flow is disconnected** | `AddFDModal.tsx` | The DB has `linked_wallet_id`, and Withdraw now credits the linked wallet — but the Add FD form never offers a wallet link, and creating an FD doesn't deduct from any wallet. Net effect: society cash silently double-counts (wallet balance + FD principal). Add "Fund from wallet" (deducts) and "Linked wallet" (receives on withdrawal). |
| B13 | **"Other" income/expense descriptions invisible** | Ledger tables | The required description is stored in `notes` but no table column, tooltip, or expandable row ever shows it. Same for Building-income sub-source. |
| B14 | **Loan status `Overdue` is never set** | Loan engine | The status exists in types/badges but no logic transitions a loan to Overdue (e.g. unpaid interest for N consecutive months). |
| B15 | **Inconsistent delete confirmations** | 8 call-sites | Members use the styled `DeleteConfirmModal`; loans, wallets, transactions, types use native `confirm()` — jarring, unthemed, and can't show consequences ("returns principal to wallet"). |

### 🟡 Low impact / polish

- **B16** Modals have no focus trap (Tab escapes to the page behind), don't lock body scroll, and Escape instantly discards unsaved form data with no warning. `AddMemberModal` also doesn't close on backdrop click while every other modal does.
- **B17** `SearchableSelect` has no keyboard support (arrows/Enter/Escape), no ARIA combobox roles, and no way to clear a selection.
- **B18** Toasts: fixed 3s auto-dismiss even for errors, no click-to-dismiss, duplicates stack.
- **B19** Date inputs accept future dates for DOB / income / expense / loan issue; no `max` attribute anywhere.
- **B20** Amount inputs (`type="number"`) accept `e`, negatives at the keyboard level, and change on scroll-wheel hover.
- **B21** Currency label mismatch: inputs say "Rs." but displays render "LKR" (`Intl` en-LK). Pick one (suggest "Rs.").
- **B22** Login: a network failure shows the raw axios message ("Network Error" / "timeout of 15000ms exceeded") instead of "Cannot reach the server".
- **B23** Members table pagination has no page numbers or jump; ledger/loan tables have **no pagination at all** — they load the entire history on every visit (a real problem after 2–3 years of records; the members endpoint already paginates, income/expenses/loans don't).
- **B24** `printable-receipt` CSS exists but nothing uses it — receipt printing was planned and never built.
- **B25** Sidebar shows raw lowercase role ("admin"); no app version anywhere except login footer and Settings → About.

---

## Part 2 — Missing items (features the data model/API already expect)

1. **Loan detail view & payment history** — `GET /loans/:id/payments` and the IPC channel exist (Phase 2), but there's no UI: no way to see guarantor names (only a count badge), repayment history, accrual dates, or a settlement projection.
2. **Receipt printing** — per-transaction receipt for income (member fee receipts) and loan repayments; the print CSS scaffold exists.
3. **Member financial statement** — ViewMemberModal shows bio data only. A "Transactions" tab (their fees, fines, benefits, loans) turns it into the member ledger the treasurer actually needs at the counter.
4. **Assets management actions** — assets can be edited/deleted via API (`assets.update/delete` are wired end-to-end) but the Society Assets table renders no action buttons.
5. **Migration Mode indicator** — nothing tells the user which mode the system is in. The "Add Existing Loan" button appearing/disappearing is the only clue.
6. **Reports** — no month/year summary, no cashflow statement, no member arrears list. "Print Ledger" (whole-page `window.print()`) is the only output.
7. **Message Portal** — nav item leads to a placeholder page.
8. **Guarantor visibility** — guarantor names aren't shown anywhere after issuance (needed when chasing a defaulted borrower).
9. **Password management** — users can be created/deleted but passwords can never be changed (no change-password or reset UI/endpoint).
10. **Fine income ↔ loan fine confusion guard** — the generic "Fine" income type and loan late-fines are distinct concepts; a short helper text in the Fine form would prevent treasurers recording loan fines manually.

---

## Part 3 — UX Enhancement Plan (prioritized)

### Phase A — Correctness & trust (quick wins, ~1–2 days)
1. Central IPC error cleanup (B2) — one utility, applied in `ipc-handlers.ts`.
2. Dashboard refresh force + remove/soften "Live" labels (B1, B11).
3. Session-expiry: on any 401, clear token + caches, return to login with "Session expired, please sign in again" (B3, B4).
4. Hide Deposit/Opening-balance in Live mode; show a slim **"Migration Mode" banner** under the header while `migration_completed=false` (B6 + missing #5).
5. Max Loan Limit field in rupees (B7); protect coded types from deletion (B8); admin-role middleware on `/users` (B5).
6. `max` attribute on date inputs; debounce member search (B19, B9).

### Phase B — Daily-workflow features (~1 week)
1. **Loan detail drawer**: click a loan row → guarantors with names, outstanding breakdown, payment history table, repay button, print statement. (API already done.)
2. **Ledger filters + pagination**: date-range picker (This month / Last month / FY / custom), type filter, server-side pagination for income/expenses/loans.
3. **Member statement tab** in ViewMemberModal (fees paid, benefits received, active loan).
4. **Receipt printing** for income entries and loan repayments using the existing `printable-receipt` CSS.
5. **FD wallet linkage**: fund-from-wallet + linked-wallet fields in Add FD (B12); Matured badge distinct from Withdrawn; "renew" action.
6. Asset edit/delete buttons (missing #4).
7. Replace all native `confirm()`s with the styled confirm modal, with consequence text (B15).
8. CSV export buttons on ledgers (Electron `dialog.showSaveDialog` via IPC).

### Phase C — Interaction & accessibility polish (~3–4 days)
1. Modal system upgrade: focus trap, body-scroll lock, unsaved-changes guard on Escape/backdrop, consistent backdrop behavior (B16).
2. `SearchableSelect`: arrow-key navigation, Enter to select, Escape to close, clear (×) button, ARIA combobox pattern (B17).
3. Toasts: 5–6s for errors with manual ×, dedupe identical messages (B18).
4. Numeric input component: rupee-formatted text input (thousands separators, blocks `e`/`-`, no wheel change) reused across all money fields (B20, B21).
5. Table quality: sticky headers, sortable columns (date/amount), page-size selector.
6. Sidebar: capitalized role, app version footer, count badges (e.g. active loans).
7. Friendly offline state: detect network failure once, show a "Server unreachable — retry" bar instead of per-action error toasts (B22).

### Phase D — Strategic (longer term)
1. 🟨 **Sinhala localization (i18n)** — for village-society treasurers this is likely the single highest-value UX investment; extract strings now, translate incrementally. *(All 9 pages done: `src/renderer/src/i18n/` provider + en/si dictionaries (363 keys, English fallback), EN/සිං switcher in sidebar footer and login page (persisted in localStorage). Translated: sidebar, login, dashboard, reports, members, incomes, expenses, loans, wallet, settings (all 6 tabs), migration banner, message-portal placeholder, and shared `LedgerFilterBar`/`ConfirmModal`. Remaining: the 18 dialogs in `modals/` (add-forms) — same mechanical `t()` swap, keys not yet added. Native Sinhala review of financial terms recommended before wide rollout.)*
2. ✅ **Reports module** — monthly summary, arrears list, annual statement (AGM handout), using existing data. *(Done: `reports.routes.js` + IPC/preload + `pages/Reports.tsx` with Monthly/Annual/Arrears tabs, print letterhead, sidebar nav item.)*
3. ✅ **Overdue automation** (B14) + dashboard "Attention needed" card: loans with unpaid interest, members without membership fee (Live mode), FDs maturing within 30 days. *(Done: loan engine flips `Active` ↔ `Overdue`; dashboard `attention` block rendered as a card that deep-links to the arrears report.)*
4. ⏸ **Message Portal**: deliberately deferred (July 2026) — needs an SMS gateway decision; placeholder page stays.
5. ✅ Role-based permissions done properly (treasurer vs viewer vs admin) — server-enforced. *(Done: viewer role is read-only at the middleware level; `/users` requires admin.)*
6. ✅ Optional dark mode via the existing CSS-variable system. *(Done: `[data-theme='dark']` token overrides in App.css, moon/sun toggle in the sidebar footer, persisted in localStorage, hardcoded hexes migrated to new `--warning-*`/`--accent-purple*`/`--chart-*` tokens. Also added: collapsible sidebar with persisted state.)*

**Post-Phase-D fixes (July 2026):** deleting a loan now fully reverses its repayments (wallet cash + auto-created interest/fine ledger entries) instead of failing with an impossible "delete the payments first" error; `loan_payments.wallet_id` added (auto-migrated at server startup, see `ensureSchema` in `server/db.js` / migration 004) so each repayment knows its receiving wallet. Reports page shows a friendly "restart needed" card if the app is running with a pre-Reports preload.

---

## Suggested execution order

Phase A is small and removes the sharpest edges — do it before wider rollout. Phase B items 1–3 change daily treasurer work the most. Phase C can ride along incrementally. Phase D-1 (Sinhala) should be scheduled deliberately since it touches every file.
