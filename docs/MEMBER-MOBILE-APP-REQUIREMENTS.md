# eSamithi Member Mobile App — Requirements & Implementation Plan

_Status: **v2 implemented (2026-07-07, testbed deploy pending)** — adds §7.1/7.2 death/meeting/general notices (staff authoring in the desktop Message Portal, Notices tab + Home highlight in the app), §7.3 push pipeline (Expo Push; token registration + server send — verify on an EAS dev build, Expo Go can't receive remote push), §5.5 loan requests + §2.5 correction requests with a desktop review queue. Previous: **v1.1 (2026-07-07)** — v1 read-only app live against the testbed (212.227.103.150). v1.1 adds the previously-missed v1 items (§1.5 biometric unlock, §1.7 not-set-up state, §3.4 how-to-pay, §4.4 how-to-claim, §6.4 Help/FAQ/About, A5 desktop staff controls for `app_enabled`/PIN reset) plus: three-way dark mode (System/Light/Dark, persisted), digital membership card with QR, Home recent-activity + dues detail screen, UI polish (loan progress bars, skeleton loaders, haptics, empty states) and an offline stale-data banner. Remaining before member rollout: deploy v1.1 backend files to prod, HTTPS (§10), native Sinhala review, EAS store builds._

## Context

eSamithi is an **Electron desktop app** used by *staff* (admin/viewer) of a Sri Lankan **Maranadhara Samithi** — a funeral/death-benefit welfare society. Members today have **no digital access** to their own data; they phone or visit the office to learn their contribution status, dues, loan balance, or what benefits they're entitled to. This document defines the requirements for a **member-facing mobile app** and how to build it.

Confirmed product decisions:
- **v1 scope:** read-only self-service (no financial writes).
- **Auth:** NIC + date of birth to enroll, then a member-chosen PIN (no SMS gateway needed).
- **Stack:** React Native + Expo (reuses the team's React/TypeScript + i18n).
- **Targets:** Android + iOS; bilingual Sinhala + English.

### What the domain actually is (grounds the requirements)
From the schema and seed data, the society runs on:
- **Contributions/collections (income_types):** `membership_fee`, `entrance_fee`, `fine`, **`funeral_food_collection`** (a per-death levy every member owes when someone in the society dies), plus `loan_interest`/`loan_fine`.
- **Benefits members receive (expense_types, each with a `standard_payout`):** `funeral_benefit`, `inlaw_funeral_benefit` (mother/father-in-law), `hospital_assistance`, `grade5_scholarship` (children's Grade-5 exam), `year_end_bonus`.
- **Dependents** (`server/routes/members.routes.js:125`) — registered family; they drive funeral-benefit eligibility.
- **Loans** with guarantors and lazily-accrued interest/fines; **physical assets** the society rents out (e.g. funeral tents/chairs); society-level **wallets/FDs**.

So for a member, the app's value is: *"What have I paid? What do I still owe (esp. funeral levies)? What benefits am I / my family entitled to, and what have I received? What's my loan and guarantee exposure? What's happening in the society (deaths, meetings)?"*

---

## Current feature set (v1.1 — shipped)

**Authentication & account:** NIC+DOB enrollment → 4–6 digit PIN (trivial PINs rejected) · NIC+PIN login with 5-attempt/15-min lockout · Forgot-PIN re-verification · rotating refresh-token session (SecureStore) with auto-refresh · opt-in biometric unlock (Face ID/fingerprint) · friendly "not set up" path (`NO_PIN`) · logout with confirmation + server-side revocation · staff kill-switch (disable access / reset PIN from desktop, sessions revoked).

**Home:** greeting + member-since + society ID · tappable dues/arrears banners (overdue loan, membership fee) with green all-clear state · total-contributed and loan-balance tiles · recent activity (last 5 movements).

**Money screens:** contributions grouped by month (Sinhala month names, running total, void flags) · dues & arrears detail (per-loan P/I/F breakdown, fee status, total due) · payouts received · loans list with status badges and repayment progress bars · loan detail (live accrued figures, guarantors, repayment history, migrated note, society rates) · my guarantees (exposure) · benefit schedule (standard payout per type).

**Identity & info:** digital membership card with QR (society ID) · read-only profile (personal/bank/dependents, contact-office note) · society info (rates, limits, office contact when set) · Help screen (how to pay, how to claim each benefit, FAQ, About).

**UX & platform:** Sinhala-first bilingual UI (persisted EN/සිං toggle, 126 shared keys) · three-way dark mode (System/Light/Dark, persisted) · offline stale-data banner over cached data · skeleton loaders, icon empty states, haptics, pull-to-refresh · large touch targets + font scaling · prod/testbed switch in `app.json` · member-scoped API with member↔staff token isolation, bcrypt PINs, rate-limited auth.

---

## Requirements Catalog

Priority = MoSCoW for **v1**. Data tag: **✅** = served by existing API today · **🟨** = small backend addition · **🟥** = new backend feature (table + staff authoring UI). This tagging drives the phasing at the end.

### 1. Identity, access & account (Must)
| # | Requirement | Data |
|---|---|---|
|1.1|Enroll with NIC + DOB, then set a 4–6 digit PIN|🟨|
|1.2|Log in with NIC + PIN; lockout after repeated failures|🟨|
|1.3|Forgot-PIN reset via NIC + DOB re-verification|🟨|
|1.4|Stay logged in via refresh token; auto-refresh short-lived access token|🟨|
|1.5|Optional biometric (Face ID/fingerprint) unlock of a saved session|✅(client)|
|1.6|Language selection Sinhala/English, persisted|✅(client)|
|1.7|Graceful "account not enabled / contact office" state (`app_enabled=0`)|🟨|
|1.8|Logout / clear session|✅(client)|

### 2. Profile & family (Must / Should)
| # | Requirement | Pri | Data |
|---|---|---|---|
|2.1|View my personal details (name, NIC, society ID, DOB, address, phone, occupation, join date)|Must|✅|
|2.2|View my bank details on file|Should|✅|
|2.3|View my registered dependents & relationships|Must|✅|
|2.4|"Contact the office to update" guidance (read-only scope)|Must|✅|
|2.5|Flag/request a correction to my details (message office)|Could(v2)|🟥|

### 3. Contributions & dues (Must) — the "do I owe anything?" core
| # | Requirement | Pri | Data |
|---|---|---|---|
|3.1|Full contribution history, grouped by type & month, with running totals|Must|✅ (`statement.income`)|
|3.2|Current dues summary: outstanding `membership_fee`, unpaid **funeral levies**, outstanding fines|Must|🟨 (derive; membership-fee `EXISTS` check already in `server/routes/reports.routes.js:103`)|
|3.3|Per-death **funeral levy** view: for each recent society death, the levy amount and whether I've paid|Should|🟥 (needs a "death event" the levy links to)|
|3.4|How-to-pay information (methods, office hours, bank details)|Should|✅(static/settings)|
|3.5|Share/export a contribution statement (PDF)|Could|🟨|

### 4. Benefits & entitlements (Must / Should) — the reason the society exists
| # | Requirement | Pri | Data |
|---|---|---|---|
|4.1|Benefits/payouts I've received (funeral, in-law, hospital, scholarship, bonus)|Must|✅ (`statement.expenses`)|
|4.2|Benefit **entitlement schedule**: standard payout per benefit type ("on a member's death: Rs. X")|Should|🟨 (`expense_types.standard_payout`, whitelisted)|
|4.3|My eligibility signals (e.g. in-law coverage, a dependent eligible for Grade-5 scholarship)|Could|🟨|
|4.4|How-to-claim a benefit (checklist/process, per benefit type)|Should|✅(static content)|

### 5. Loans & guarantees (Must)
| # | Requirement | Pri | Data |
|---|---|---|---|
|5.1|My loans list with status and current owed (principal + accrued interest + fines)|Must|✅ (must run accrual, `server/routes/loans.routes.js:353`)|
|5.2|Loan detail + full repayment history|Must|✅ (`/loans/:id/payments`)|
|5.3|Loan terms/eligibility info: interest rate, max limit, required guarantors|Should|🟨 (whitelisted `settings`)|
|5.4|Guarantees I've given for others + my exposure|Must|✅ (`statement.guarantees`)|
|5.5|Request a new loan (submit application)|Could(v2)|🟥|

### 6. Society info & governance (Should / Could)
| # | Requirement | Pri | Data |
|---|---|---|---|
|6.1|Society name, interest & fine rates, contact info|Should|🟨(whitelisted settings)|
|6.2|Committee / office-bearers directory + contact numbers|Should|🟥|
|6.3|By-laws / constitution / benefit-schedule documents (view/download)|Could|🟥|
|6.4|About / app help & FAQ|Should|✅(static)|

### 7. Notices & communications (Should — but central to a funeral society)
| # | Requirement | Pri | Data |
|---|---|---|---|
|7.1|**Death notices**: when a member/dependent dies, a notice with funeral details (so members attend & know a levy is due)|Should|🟥|
|7.2|Announcements: meetings, AGM, events, general notices|Should|🟥|
|7.3|**Push notifications** for death notices, dues/levy reminders, meeting reminders|Should|🟥 (Expo Push + tokens table + staff authoring)|
|7.4|Two-way messaging / queries to the office|Could(v2)|🟥|
> This is the single highest member-value feature beyond read-only data, and it intersects the deferred desktop **Message Portal**. Deferred to v2 (see Decisions below).

### 8. Meetings & attendance (Could — v2/v3)
| # | Requirement | Pri | Data |
|---|---|---|---|
|8.1|Meeting calendar/schedule|Could|🟥|
|8.2|My attendance record & absence fines (the `fine` income type)|Could|🟥 (attendance not modeled today)|

### 9. Assets (Could — v2/v3)
| # | Requirement | Pri | Data |
|---|---|---|---|
|9.1|Browse society asset catalogue (tents/chairs/funeral equipment) & availability|Could|🟨/🟥|
|9.2|Reserve/request an asset for a funeral/event|Could(v2)|🟥|

### 10. Non-functional requirements
- **Security:** bcrypt/argon2 for PIN hashing (not the codebase's unsalted SHA-256 at `server/routes/auth.routes.js:8`); login lockout + rate-limiting; **HTTPS mandatory** (API is plain HTTP today); every endpoint hard-scoped to the caller's `member_id` with ownership checks; member vs staff JWTs non-interchangeable (`typ` claim); refresh token stored in `expo-secure-store`, access token in memory; no plaintext caching of sensitive data.
- **Performance & data cost:** target low-end Android; small JS bundle; minimize payload/round-trips (mobile data is a real cost in SL) — the single `/me/statement` call already backs several screens.
- **Offline/resilience:** React Query cache shows last-fetched data on flaky 3G while revalidating; clear loading/empty/error states.
- **Localization:** Sinhala-first with English fallback; correct `Rs.` currency (cents→`formatCurrency`) and Sinhala month names (already in the desktop i18n); native review of financial terms (ණය/පොලිය/දඩ මුදල්/හිඟ) before rollout.
- **Accessibility:** many members are elderly — large touch targets, dynamic font scaling, high contrast, simple tab navigation, light/dark parity.
- **Compatibility:** Android 8+ and iOS 14+.
- **Privacy/compliance:** aligns with Sri Lanka's **PDPA (2022)** — data minimization (don't ship fields the app doesn't show), consent on first run, secure deletion on logout.
- **Observability & updates:** crash reporting (e.g. Sentry) + minimal analytics; **EAS OTA updates** for fast fixes without store re-review.
- **Support:** a clear path when a member is locked out (office resets PIN / `app_enabled`).

---

## Architecture (how the above is built)

### Part A — Backend: member auth + read-only `/me` API
1. **Schema** (idempotent, in `ensureSchema()` in `server/db.js` — no migration runner per project convention; add a documentation-only `005_member_app_auth.sql` to mirror): on `members` add `pin_hash`, `pin_set_at`, `failed_pin_attempts`, `pin_locked_until`, `app_enabled`; new `member_refresh_tokens(member_id, token_hash, expires_at, revoked_at, created_at)`.
2. **`/api/v1/member-auth`** (`server/routes/memberAuth.routes.js`): `verify-identity` (NIC+DOB → 10-min enrollment token), `set-pin`, `login`, `refresh` (rotating), `reset-pin`. Access JWT `{member_id, typ:"member"}`; opaque refresh token (store sha256 only). Add `express-rate-limit` on verify/login/reset; bcrypt for `pin_hash`.
3. **`server/middleware/memberAuth.js`**: verify JWT, **reject unless `typ==="member"`**, set `req.member`. Two-way isolation from staff routes is the core security property.
4. **`/api/v1/me`** (all behind that middleware, every query scoped to `req.member.id`): `GET /profile`, `GET /statement` (reuse the verbatim query at `server/routes/members.routes.js:72`), `GET /loans/:id` + `/payments` (run `getRates`/`accrueLoan` first, then assert ownership → 404), `GET /dues` (§3.2 derivation), `GET /benefits-schedule` (§4.2 whitelisted `expense_types`), `GET /society-info` (§6.1 whitelisted `settings`).
5. **Reuse:** extract the shared statement SQL and `getRates`/`accrueLoan` (today inside `loans.routes.js`) into `server/lib/memberQueries.js`, imported by both staff and member routes so views can't drift.
6. **Staff controls (small):** `PUT /api/v1/members/:id/app-access` (toggle `app_enabled`, reset PIN), surfaced in the desktop member modals (`vmember.`/`mform.`).
7. **HTTPS (infra, mandatory):** put the API (`http://141.147.75.132`) behind TLS (domain + Caddy/Nginx + Let's Encrypt). Parallel track.

### Part B — Expo app (`mobile/`, separate workspace — do **not** add RN deps to root `package.json`)
- **Libraries:** Expo Router, @tanstack/react-query, axios (401→refresh interceptor), expo-secure-store, expo-local-authentication.
- **Structure:** `app/` routes — `(auth)/{welcome,verify,set-pin,login}`, `(tabs)/{home,contributions,loans,more}`, `loans/[id]`, plus `profile`, `benefits`, `guarantees`, `payouts`, `society`; `src/{api,auth,i18n,lib,components}`.
- **Screens (v1, read-only):** Home (greeting, membership status, total contributed, active-loan balance, **dues/levy banner** from `/me/dues`); Contributions; Loans + detail; Benefits (received + entitlement schedule); Payouts; Guarantees; Profile; Society/About.
- **i18n:** copy `src/renderer/src/i18n/en.ts` and `si.ts` **verbatim** (pure data; `si[key] ?? en[key]` fallback, `{var}` interpolation, month arrays all port unchanged); adapt only `index.tsx` (swap `localStorage`→`expo-secure-store`/`AsyncStorage` with async hydration; rebuild `LangSwitcher` in RN `Pressable`/`StyleSheet`). Add the new member-app keys to both files keeping en/si parity. Port `formatCurrency` into `mobile/src/lib/money.ts`.
- **UX:** pull-to-refresh, cached-while-revalidating, accessibility (large targets, font scaling), light/dark parity.

---

## Phased roadmap
- **v1 (confirmed scope):** Requirements §1, §2 (2.1–2.4), §3.1–3.2 & 3.4, §4.1–4.2 & 4.4, §5.1–5.4, §6.1 & 6.4, §10 (all non-functional). = read-only self-service, member-private + benefit schedule. Everything here is ✅ or a small 🟨. **No** fund-transparency totals and **no** committee directory in v1.
- **v2 (needs the notices backend + writes):** §7.1–7.3 (death notices, announcements, **push**), §3.3 (per-death levy tracking), §6.2 (committee directory), §5.5/§2.5 (loan & correction requests).
- **v3:** §8 (meetings/attendance), §9 (asset catalogue/reservation), §7.4 (two-way messaging), §6.3 (documents).

---

## Decisions locked (from user)
- **Notices/push (§7) → v2, not v1.** v1 stays strictly read-only self-service; death notices + announcements + push land as a focused v2 (new `announcements`/`death_events` table, desktop authoring screen, Expo push).
- **Society-level exposure in v1 = member-private + benefit schedule only.** Show the member's own records plus the standard benefit-payout schedule (§4.2) and society rates/contact (§6.1). **No** aggregate fund/FD/member-count transparency and **no** committee directory in v1 (§6.2 → v2).

---

## Verification
**Backend:** `node --check` each new/changed server file; restart twice to confirm `ensureSchema()` is idempotent; curl the flow — `verify-identity` (right/wrong DOB), `set-pin`, `login` (lockout after N), `refresh` (old token rejected on reuse), `GET /me/statement` (only own rows; staff token → 401; other member's loan → 404; own loan shows accrued figures), `GET /me/society-info` and `/benefits-schedule` return only whitelisted fields.

**Mobile:** `npx expo start` — enroll → set PIN → real data → relaunch → PIN login → EN↔සිං toggle → pull-to-refresh; point at the **HTTPS** endpoint and confirm on a physical Android device (cleartext otherwise blocked); `eas build --profile preview` for Android internal testing.

**Desktop (staff controls):** `npm run build` + `npx tsc --noEmit -p tsconfig.web.json --ignoreDeprecations 6.0`.
