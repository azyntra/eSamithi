# eSamithi Member App — Redesign Requirements ("eSamithi Calm")

**Status:** Approved 22 Nov 2026 · phases 1–6 shipped over the air the same day (see §9) · **Date:** 22 November 2026 · **App:** eSamithi Member 1.5.0 (Android versionCode 9, runtime `ea464a6c…`)
**Owner:** Sachira · **Applies to:** `mobile/` (Expo SDK 57, React Native, expo-router)
**Visual mockups:** <https://claude.ai/artifact/5BDwRGjFJsHEcYWjoni6nJ> (private until shared from its Share menu)
**Supersedes, for look, layout and navigation:** `ESAMITHI-MOBILE-UIUX-REQUIREMENTS.md` (Sept 2026). That document's motion, Sinhala-typography and Android-trap rules **remain in force** and are restated in §1.4.
**Depends on:** `MEMBER-MOBILE-APP-REQUIREMENTS.md` (what the app does) · `ESAMITHI-WEB-APP-REQUIREMENTS.md` §4 (the shared brand) · `MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md` (the staff scanner)

---

## 0. Executive summary

The September refresh fixed what was *broken*: animations no longer bounce, Sinhala headings
are bold, every colour pair passes WCAG AA, and eight hand-made rows became one `ListRow`.
What it deliberately did not touch is what members actually *see*: every screen is still a
column of near-identical white cards on a grey page, the most important fact on each screen
is the same size and weight as the least important, six tabs crowd a 360 dp phone (three
Sinhala labels only just fit), and nothing in the app feels like it was made for a person.

This document specifies a full redesign — look, layout, navigation and interaction — under
one design language, **eSamithi Calm**, grown from the one piece members already like: the
new branded membership card (deep-blue gradient, white eS tile, tinted panels, navy ink).

What a member will notice:

1. **Home answers "am I OK?" in one glance.** A gradient hero carries their name, society and
   a single plain-language status ("You're up to date" / "Rs 2,450 is overdue"), with one
   clear next step.
2. **Five tabs instead of six,** each with a word that fits in Sinhala: Home · My Money ·
   Notices · Puruka · Me. Contributions, loans, dues and payouts live together under My Money.
3. **Numbers you can read from arm's length.** Money is the hero of every money screen, in a
   dedicated display size with tabular digits; supporting detail steps back.
4. **Death notices that look like what they are.** A calm memorial treatment — slate, not
   alarm red — with the deceased's name first and the funeral details easy to find.
5. **Screens that talk like a person.** Warm, short Sinhala and English copy; every empty and
   error state says what happened and what to do next; taps answer with a gentle haptic.
6. **The same eSamithi everywhere.** The phone, the web app and the desktop (now the web app
   in a window, desktop 1.4.0) share one blue, one navy, one type system.

Features, API and data are **unchanged**. Everything except a final optional phase ships
**over the air** to 1.5.0.

---

## 1. Users, goals, decisions, non-negotiables

### 1.1 Who this app is for

Members of a Sri Lankan village welfare society (*maranadhara samithi*). Mostly middle-aged
to elderly, rural, Sinhala-first; budget Android phones (2–3 GB RAM, 720p, Android 10–14),
often on 3G, often read outdoors. Many share a phone with family. A smaller group are
**society staff** who also use the app to mark attendance with the QR scanner.

### 1.2 The four questions

Every screen is judged by how fast it answers the question that brought the member there:

| # | Question | Where it is answered |
|---|---|---|
| Q1 | **Do I owe anything?** | Home hero status, My Money banner, Dues |
| Q2 | **What have I paid / what do I owe on my loan?** | My Money (Contributions, Loans), receipts |
| Q3 | **What is happening in my society?** | Notices, Home "latest notice", push |
| Q4 | **Show my card.** | Home quick action, Me → Card, large QR |

### 1.3 Decisions taken with the owner (22 Nov 2026)

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D1 | Depth | **Full redesign + navigation** | New design language on every screen; tabs reduced to five; features and API untouched |
| D2 | Visual direction | **Premium calm, card-led** | Built from the membership card: gradient hero, crisp white cards, navy ink, one blue accent, generous space |
| D3 | Deliverables | **This document + high-fidelity mockups** | Mockups are the visual source of truth for the screens they cover; this document wins on behaviour |
| D4 | Release | **OTA first, binary later OK** | Phases 1–6 ship on the `prod` channel to runtime `ea464a6c…`; phase 7 is a new Play build |

### 1.4 Non-negotiables (carried forward — each one cost a bug to learn)

1. **Sinhala is the default and is verified first.** A screen checked only in English is not checked.
2. **No `fontWeight` without a family.** Weight comes from `useType().family.*`; Android otherwise falls back to the system Sinhala face at regular weight (`src/typography.tsx`).
3. **Every `ty.family` text has a `lineHeight` from `ty.lh()`,** which scales with the phone's font-size setting.
4. **SVG fills live inside an absolute-fill `View`,** never as an absolutely positioned percentage-sized `Svg` (Android drew one at ~300 × 34 dp on 22 Nov 2026; fixed in `64c729fc`). `BrandGradient` (`src/ui/index.tsx:45`) is the pattern.
5. **SVG never wraps a `Pressable`'s touch area** (gradient-as-sibling, two past bug fixes).
6. **No Android `elevation` on large-radius cards** — it smudges; use a hairline border plus an iOS-only shadow.
7. **One spring: `SPRING.settle`** (ζ = 1.00) from `src/motion.ts`; reduced motion respected.
8. **Gates stay green:** `npx tsc --noEmit`, `scripts/check-contrast.mjs`, `check-motion.mjs`, `check-type.mjs` — plus the new `check-tokens.mjs` (§10).
9. **Every phase is shippable on its own.** A half-redesigned app never reaches a member.
10. **Web preview is not proof.** Expo-web renders things Android does not (and cannot run the app's SecureStore login). Every phase is signed off on a real Android phone.

### 1.5 Out of scope

API or data-model changes · new features beyond the
navigation, notice-detail screen and push-tap routing defined here · iOS release · the web
and desktop apps · the printed card (already redesigned).

---

## 2. Current-state audit

Evidence is from the source (paths below) and the owner's device screenshots of 22 Nov 2026
(Home, Card). Live web capture was attempted against the testbed and stopped at sign-in:
the app stores its session in `expo-secure-store`, which has no web implementation, so the
"before" pictures are the owner's phone screenshots plus the code.

### 2.1 App-wide

| # | Finding | Evidence | Effect on a member |
|---|---|---|---|
| A1 | **One visual weight everywhere.** Every block is the same `Card` (white, radius 20, hairline) on `#f1f5f9`; the page has no anchor | `src/ui/index.tsx:159` used by every screen | The eye has nowhere to land; "am I OK?" competes with "latest notice" |
| A2 | **Six tabs on a 360 dp phone** — ~58 dp per label; `දායක මුදල්`, `දැනුම්දීම්`, `මුල් පිටුව` shrink or wrap | `src/ui/TabBar.tsx`, `(tabs)/_layout.tsx` | The primary navigation is the least readable text in Sinhala |
| A3 | **Related money is split across three tabs and three stack screens** — Contributions (tab), Loans (tab), Dues, Payouts, Benefits, Guarantees (More → stack) | `(tabs)/contributions.tsx`, `(tabs)/loans.tsx`, `dues.tsx`, `payouts.tsx` | "What do I owe and what have I paid" needs four places |
| A4 | **"More" is a junk drawer** of 11 rows across 4 sections, mixing personal, society and settings | `(tabs)/more.tsx:60-72` | Members cannot predict where anything is |
| A5 | **Literal sizes still in screens** — 13 `fontSize: 14`/`12` literals in Contributions/Loans/Loan detail alone, padding `12`, `6`, `4` | `(tabs)/contributions.tsx`, `loan/[id].tsx` | Rhythm drifts screen to screen |
| A6 | **Money is not the hero on money screens.** Totals are 22–24 sp inside a generic card, the same visual tier as list rows | `contributions.tsx` (`size={22}`), `dues.tsx` (`size={24}`) | The one number that matters does not stand out |
| A7 | **Rows show raw data, not meaning.** Repayment rows print `Principal: 1,000 · Interest: 50 · Fines: 0` as one line of muted text | `loan/[id].tsx` repayment row | Elderly readers cannot parse it |
| A8 | **Empty and error states are an icon and a sentence** with no next step | `EmptyState`, `ErrorView` (`src/ui/index.tsx:524,649`) | A member who sees "no contributions" does not know whether that is a problem |
| A9 | **Push taps go nowhere.** No notification-response listener exists; tapping a death-notice push just opens the app on Home | no `addNotificationResponseReceivedListener` in `src/` | The most urgent message needs three more taps |
| A10 | **Death notices use alarm red** (`danger` on `dangerBg`) — the same colour as an overdue loan | `(tabs)/notices.tsx` `noticeMeta` | A bereavement reads like a warning |
| A11 | **Status colour is decoration in places** — green "general" notices, amber "meeting" icon on Home | `notices.tsx`, `(tabs)/index.tsx` latest-notice row | Colour stops meaning "state" |
| A12 | **No sense of place.** Stack screens use the default native header with a plain title; Home has no header at all | `_layout.tsx` Stack options | Members lose track of where they are after a push |

### 2.2 Per screen (summary — each is resolved in §6)

| Screen | File | Main problems |
|---|---|---|
| Welcome | `(auth)/index.tsx` | Good bones (logo, language toggle); generic hero; "I already have a PIN" is a weak text link |
| Society code | `(auth)/samithi.tsx` | Free-text code with no format help; the "found" confirmation is a plain card |
| Verify | `(auth)/verify.tsx` | NIC and date of birth as two bare inputs; DOB typed as text |
| Set PIN / Login | `(auth)/set-pin.tsx`, `login.tsx` | PIN typed in a text field with the system keyboard; no PIN pad, no dots |
| Home | `(tabs)/index.tsx` | Six stacked cards of equal weight (A1); quick actions and recent activity below the fold |
| Contributions | `(tabs)/contributions.tsx` | Total in a generic card; month groups fine but dense; no year view |
| Loans / Loan detail | `(tabs)/loans.tsx`, `loan/[id].tsx` | Progress bar thin and unlabelled at a glance; repayment rows unreadable (A7) |
| Dues | `dues.tsx` | Reached only from Home; per-loan cards repeat principal/interest/fines with colour-only meaning |
| Payouts / Benefits / Guarantees | `payouts.tsx`, `benefits.tsx`, `guarantees.tsx` | Three thin screens hidden in More |
| Notices | `(tabs)/notices.tsx` | Death notice in red (A10); every notice fully expanded inline; no detail screen |
| Puruka feed / detail / new / mine | `(tabs)/puruka.tsx`, `puruka/[id].tsx`, `puruka-new.tsx`, `puruka-mine.tsx` | The most "app-like" area already; filters crowd the top; the new-post form is one long scroll of 10+ fields |
| More | `(tabs)/more.tsx` | Junk drawer (A4) |
| Profile | `profile.tsx` | 13 label/value rows, no hierarchy, no avatar |
| Card | `card.tsx` | Good after 22 Nov; hint text duplicated was fixed in `64c729fc` |
| Requests / New request | `requests.tsx`, `new-request.tsx` | Status only as a pill; form has no guidance on amount/purpose |
| Society / Funds / Help | `society.tsx`, `society-funds.tsx`, `help.tsx` | Text-heavy, no structure beyond rows |
| Attendance (staff) | `attendance/index.tsx`, `new.tsx`, `[id].tsx` | Functionally strong (575-line scanner); visual language differs from the rest |
| Receipt | `receipt/[kind]/[id].tsx` | 16 rows; the amount does not lead |

### 2.3 What is good and must survive

* `src/typography.tsx` — language-aware families and `lh()` that scales with font size.
* `src/motion.ts` — the settle spring and reduced-motion handling; `scripts/check-motion.mjs`.
* `ListRow`, `StatusPill`, `Chip`, `AmountCard`, `Segmented`, `ListScreen` (`src/ui/index.tsx`) — extended, not replaced.
* The membership card (`src/ui/MembershipCard.tsx`) — the seed of this design.
* Always-labelled tabs (elderly members get lost with icon-only navigation).
* `Money` in Inter with tabular digits; `formatCurrency` (`src/lib/money.ts`).
* Pull-to-refresh, skeletons, `StaleBanner` pattern (`isError && data`), haptics on tab switch.
* The scanner's offline queue, torch, one-row-per-member behaviour.

---

## 3. Design language — "eSamithi Calm"

### 3.1 Principles

1. **One glance, one answer.** Each screen has exactly one hero — the thing that answers its question — and everything else is visibly secondary.
2. **Calm surfaces, one accent.** White cards on a cool near-white page; eSamithi blue only for the brand hero, primary actions and selection. Status colours appear only when they carry a state.
3. **Legible before elegant.** The reader may be 70, outdoors, at 150 % font size. When density and legibility conflict, legibility wins.
4. **Sinhala is the design language.** Layouts are drawn for Sinhala line heights and label lengths and checked in English second.
5. **Warm, respectful voice.** The app speaks like a helpful society officer, never like a bank's error log — and quietly when someone has died.
6. **Motion explains, never entertains.** Movement answers "what changed?" or "where did that come from?".
7. **The token is the only number.** No literal colour, size, space or radius in a screen file.

### 3.2 Colour

All ratios computed (WCAG 2.x relative luminance), both themes. Text pairs need ≥ 4.5:1;
icons, borders and state indicators ≥ 3:1.

**Brand (from the membership card, aligned with the web scale)**

| Token | Light | Dark | Role |
|---|---|---|---|
| `heroStart` | `#1E64D4` | `#1B55B8` | Gradient start (hero, card header, primary CTA) |
| `heroMid` | `#1752B4` | `#174A9F` | Gradient midpoint (55 %) |
| `heroEnd` | `#0D3B8C` | `#0D2F6B` | Gradient end |
| `onHero` | `#FFFFFF` | `#FFFFFF` | Text on the hero — **5.48:1** at the lightest stop (light), **6.91:1** (dark) |
| `onHeroMuted` | `#E4EDFD` | `#C9DAF8` | Secondary hero text — **4.66:1** / **4.89:1** at the lightest stop |
| `primary` | `#1E64D4` | `#5B9BF8` | Actions, links, selected — **5.48:1** on surface / **6.08:1** |
| `primaryPressed` | `#1752B4` | `#7DAFF9` | Pressed primary |
| `onPrimary` | `#FFFFFF` | `#0A1324` | Label on primary — **5.48:1** / **6.62:1** |
| `primarySoft` | `#EAF1FD` | `#18294A` | Selected chip/segment, tinted panels |
| `primaryOnSoft` | `#1752B4` | `#A9C8FB` | Text on `primarySoft` — **6.37:1** / **8.48:1** |

**Neutrals**

| Token | Light | Dark | Check |
|---|---|---|---|
| `bg` | `#F3F6FB` | `#0A1324` | Page |
| `surface` | `#FFFFFF` | `#111C30` | Cards, sheets |
| `surfaceAlt` | `#F6F8FC` | `#17243C` | Insets, input fill, icon chips |
| `border` | `#E2E8F1` | `#22314B` | Hairlines (decorative, no contrast requirement) |
| `borderStrong` | `#7E8CA2` | `#5C7194` | Input and control boundaries — **3.41:1** on surface, **3.21:1** on surfaceAlt / **3.44:1** |
| `text` | `#0F2547` | `#E6ECF5` | Body — **15.26:1** / **14.34:1** on surface |
| `textMuted` | `#52627A` | `#9EADC2` | Secondary — **6.20:1** / **7.47:1** on surface, **5.72:1** / **8.14:1** on bg |
| `textSubtle` | `#7A889C` | `#7486A0` | Placeholders and non-essential hints only — **3.60:1** / **4.59:1** |

**Semantic** (each with a soft background; colour never travels alone — always icon, sign or word too)

| Token | Light | Dark | On soft | On surface |
|---|---|---|---|---|
| `success` / `successSoft` | `#166534` / `#E6F4EA` | `#4ADE80` / `#0E2A1B` | 6.28 / 8.82 | 7.13 / 9.78 |
| `warning` / `warningSoft` | `#9A4A06` / `#FDF1E3` | `#FBBF24` / `#2D2110` | 5.62 / 9.41 | 6.26 / 10.21 |
| `danger` / `dangerSoft` | `#B91C1C` / `#FDECEC` | `#F87171` / `#361518` | 5.66 / 5.94 | 6.47 / 6.16 |
| `memorial` / `memorialSoft` | `#334155` / `#EEF1F5` | `#CBD5E1` / `#1E293B` | 9.14 / 9.85 | 10.35 / 11.47 |

**Rules**

* **Gradient is reserved** for: the Home hero, the membership card, the Welcome screen and the primary call-to-action button. Nowhere else.
* **`primarySoft` means "selected or brand-tinted information"** (selected chip, membership-number panel). Decorative icon chips use `surfaceAlt`.
* **`memorial` is only for death notices** (§3.9). Red never appears on a bereavement.
* **`danger` is only for money owed, overdue, destructive actions and errors.**
* `warning` is deeper than September's `#B45309` (`#9A4A06`) so it passes on its own soft tint with margin.
* The palette lives in `src/theme.tsx` (`palettes.light/dark`); `check-contrast.mjs` gains the new pairs (`onHeroMuted`/`heroStart`, `borderStrong`/`surface`, `memorial`/`memorialSoft`).

### 3.3 Typography

Families unchanged: Inter (Latin) / Noto Sans Sinhala (Sinhala), resolved by `useType()`;
Sinhala line-height ratio 1.55, Latin 1.35; Sinhala bold ceiling 700.

| Token | Size (sp) | Family | Use |
|---|---|---|---|
| `hero` (code name; `display` stays 28) | **34** | Inter ExtraBold, tabular | **New.** Hero amounts only (Dues total, receipt amount, funds total) |
| `title` | 28 | extrabold | Screen titles (large header), hero greeting |
| `heading` | 22 | bold | Card heroes, notice titles |
| `subheading` | 18 | semibold | Section titles, list primary text in cards |
| `body` | 16 | regular | Body, list rows |
| `caption` | 14 | regular | Secondary lines, labels |
| `micro` | 12 | semibold | Overlines (uppercase in Latin only), badges, tab labels |

* `check-type.mjs` allows `34` (and still rejects any other literal).
* Money always uses `Money` → Inter, `tabular-nums`, `Rs.` prefix via `formatCurrency`.
* Latin overlines may be uppercase + 0.08 em tracking; **Sinhala is never letter-spaced or uppercased.**
* Minimum on-screen text 12 sp, and 12 sp only for labels that are repeated elsewhere.
* Font scale: layouts must survive **200 %** (wrapping, not clipping; numbers may shrink with `adjustsFontSizeToFit` to 0.75 minimum).

### 3.4 Space, shape, depth

```
spacing = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32, huge:48 }   // + huge
radius  = { sm:10, md:14, lg:20, xl:28, pill:999 }                        // unchanged
```

* Screen gutter **16**; card padding **16** (list cards) or **20** (hero/summary cards); gap between cards **12**; between sections **24**.
* One card: `surface`, `radius.lg`, 1 px `border`, iOS shadow `elevation.sm`, **no Android elevation**.
* The Home hero: full-bleed under the status bar, bottom corners `radius.xl`, content gutter 20.
* Row minimum height **56**; touch target minimum **48 × 48**.
* Arithmetic on tokens (`spacing.lg - 2`) is banned — add a step if one is missing.

### 3.5 Iconography

* **Ionicons outline** at 24 (navigation, actions) and 20 (inside rows); filled variant only for the active tab.
* **Icon chips:** 40 dp circle in rows (`surfaceAlt` bg, `primary` icon), 56 dp in empty/error states, 32 dp in dense lists. No other sizes.
* Domain icon map (one icon per meaning, used everywhere):

| Meaning | Icon | Meaning | Icon |
|---|---|---|---|
| Contribution / paid in | `arrow-down-circle-outline` | Payout / paid out | `arrow-up-circle-outline` |
| Loan | `wallet-outline` | Dues / overdue | `alert-circle-outline` |
| Membership card | `id-card-outline` | QR | `qr-code-outline` |
| Death notice | `flower-outline` | Meeting | `calendar-outline` |
| General notice | `megaphone-outline` | Puruka | `storefront-outline` |
| Request | `document-text-outline` | Society | `business-outline` |
| Help | `help-buoy-outline` | Settings | `settings-outline` |

* **No emoji as icons, anywhere.**

### 3.6 Imagery and empty states

* Simple two-tone **line illustrations** (stroke `primary` at 100 %, fill `primarySoft`), 120 dp, for: no contributions yet, no loans, no notices, no requests, Puruka empty, offline, generic error. Drawn as inline SVG components in `src/ui/illustrations/` (no image downloads, OTA-safe).
* Every empty state = illustration + one-line title + one sentence of meaning + (optional) one action. Example: *No loans* — "You have no loans with the society. When you take one, its balance and repayments appear here." [Ask about a loan].

### 3.7 Motion and haptics

| Moment | Motion | Haptic |
|---|---|---|
| Press any tappable | scale to 0.97, `SPRING.settle` | none |
| Tab switch | content cross-fade 120 ms; active pill slides | `selection` |
| Push to a detail screen | native stack slide | none |
| Sheet open/close | slide from bottom 240 ms, backdrop fade | none |
| Pull-to-refresh completes | list settles | `light` |
| Success (request sent, post published, attendance marked) | check draws in 300 ms | `success` |
| Error / refused | field shakes 2 × 4 dp, 200 ms | `warning` |
| Card → large QR | card scales up into the QR sheet (shared-element feel) | `light` |
| Amount appears | number counts up 400 ms **only on Home hero, first load** | none |

Reduced motion: all of the above become instant fades; count-up disabled.

### 3.8 Voice and microcopy

* Address the member directly and kindly: **"You're up to date"**, not "No dues"; **"Rs 2,450 is overdue"**, not "Outstanding: 2450".
* Errors say *what happened* and *what to do*: "We couldn't reach the society server. Check your internet and pull down to try again."
* Sinhala copy is written, not translated: short, polite (*කරුණාකර* only where a real request is made), no English loanwords where a common Sinhala word exists.
* Numbers: `Rs. 1,250.00` in both languages (matches receipts); dates `22 නොවැ 2026` / `22 Nov 2026` via `formatDate`.

### 3.9 The memorial treatment (death notices)

* Colour: `memorial` on `memorialSoft`; a thin `memorial` rule on the left of the card header, never red, never a gradient.
* Content order: overline "Death notice / මරණ දැන්වීම" → **deceased's name** (heading) → member number if a member → funeral date (date block) → funeral place → body text.
* Icon: `flower-outline`. No celebratory or alarm colour, no exclamation marks, no count badges that pulse.
* Push title copied from the office's notice verbatim; the app adds nothing.

---

## 4. Information architecture

### 4.1 Five tabs

| Tab | Route | Icon (idle / active) | EN | SI (proposal — owner decides, §11 O1) |
|---|---|---|---|---|
| Home | `(tabs)/index` | `home-outline` / `home` | Home | මුල් පිටුව |
| My Money | `(tabs)/money` (**new**) | `wallet-outline` / `wallet` | My Money | මගේ මුදල් |
| Notices | `(tabs)/notices` | `notifications-outline` / `notifications` | Notices | නිවේදන |
| Puruka | `(tabs)/puruka` | `storefront-outline` / `storefront` | Puruka | පුරුක |
| Me | `(tabs)/me` (**new**, replaces `more`) | `person-circle-outline` / `person-circle` | Me | මම |

At 360 dp each slot is 72 dp (from ~58), enough for every proposed Sinhala label at 12 sp in one line.

### 4.2 Where everything goes

```
Home ─┬─ hero: greeting, society, status → Dues
      ├─ quick actions: Card · Dues · Request · Help (+ Attendance for staff)
      ├─ two summary tiles → My Money (Contributions / Loans)
      ├─ latest notice → Notice detail
      ├─ membership card (compact) → Card
      └─ recent activity → Receipt

My Money ─┬─ summary (contributed · loan owed) + dues banner when anything is due
          ├─ segment: Contributions → Receipt
          ├─ segment: Loans → Loan detail → Receipt
          └─ segment: Payouts → Receipt
          (Dues opens as its own screen from the banner)

Notices ── list (filter chips) → Notice detail (new)

Puruka ─┬─ feed (search, filter sheet) → Post detail → Photo viewer
        ├─ + New post (stepper)
        └─ My posts

Me ─┬─ header: avatar, name, member no., society → Profile
    ├─ My membership: Card · Profile · Requests · Benefits · Guarantees
    ├─ My society: About the society · Society funds · Help
    ├─ Staff tools (only with the attendance permission): Attendance
    ├─ App: Language · Appearance · Fingerprint unlock · My societies
    └─ Sign out · version
```

### 4.3 Route map (old → new)

As built: no push payload, deep link or saved state pointed at the old tab or Payouts routes
(push taps opened the Notices tab), so the old files were removed rather than redirected.

| Old route | New route | Note |
|---|---|---|
| `(tabs)/contributions` | `(tabs)/money?view=contributions` | `Redirect` component in the old file for one release, then removed |
| `(tabs)/loans` | `(tabs)/money?view=loans` | as above |
| `payouts` | `(tabs)/money?view=payouts` | stack screen retired |
| `(tabs)/more` | `(tabs)/me` | |
| `dues`, `loan/[id]`, `receipt/[kind]/[id]` | unchanged | stack screens |
| — | `notice/[id]` | **new** detail screen |
| `card`, `profile`, `requests`, `new-request`, `benefits`, `guarantees`, `society`, `society-funds`, `help`, `attendance/*`, `puruka/*`, `puruka-new`, `puruka-mine` | unchanged | restyled only |

### 4.4 Push-notification routing (new)

Add a response listener in `src/lib/push.ts` (initialised from `app/_layout.tsx` after auth):

| `data.type` | Opens |
|---|---|
| `announcement` (with `id`) | `notice/[id]`; if the notice has expired or is hidden → Notices list with a toast "This notice is no longer shown" |
| `request` (status change, if sent) | `requests` |
| anything else / missing | Home |

Cold start from a tap waits for auth; if the session is locked, unlock first, then route.

---

## 5. Component library v2 (`src/ui/`)

Each component: tokens only, both themes, Sinhala first, ≥ 48 dp target, `accessibilityRole`
and a Sinhala `accessibilityLabel`, works at 200 % font scale. **Extend existing components
in place**; the "Builds on" column names what to reuse.

| Component | Builds on | Anatomy and variants | States / rules |
|---|---|---|---|
| **HeroHeader** | `BrandGradient` | Full-bleed gradient under the status bar; row: eS tile (36) + society name + bell + avatar; greeting (`title`); slot for a status card. Bottom radius `xl`; faint rings + "eS" watermark like the card | Status bar icons light; content never under the notch (`useSafeAreaInsets`) |
| **AppHeader** | expo-router Stack header | Large title (28) that collapses to 18 on scroll; back chevron 48 dp; optional right action | Title never truncates mid-word in Sinhala — wraps to two lines in large mode |
| **TabBar v2** | `ui/TabBar.tsx` | 5 slots, icon 24 + label 12; active = filled icon + `primarySoft` pill + `primaryOnSoft` label; notices badge (dot ≤ 9, "9+") | Labels never shrink below 12 sp; one line |
| **StatusCard** | `Card` + `ListRow` | On the hero (translucent white 14 % in dark, solid white in light): icon chip + one-line status + chevron. Variants: `ok` (success), `due` (warning), `overdue` (danger) | Whole card is one button → Dues |
| **QuickAction** | `ScalePressable` | 64 dp circle chip (`surface` on hero area, `surfaceAlt` elsewhere) + label under (2 lines max) | 4 per row; 5th wraps; staff get "Attendance" first |
| **StatTile** | `AmountCard` | Half-width tile: icon chip, label (caption), amount (`heading`, tabular), optional trend/sub-label | Tappable → its section |
| **AmountHero** | `AmountCard` | Full-width: overline label, amount in `display` (34), sub-line, optional tone | Tone only from state: success / warning / danger |
| **ListRow** | `ListRow` (`ui/index.tsx:671`) | Icon chip 40 · primary text · secondary text · trailing value or chevron · separator | Min height 56; `first` hides the top separator (existing) |
| **TimelineRow** | `ListRow` | Date column (day number large + month small) · title · sub-line · amount (signed, coloured) | Used by Contributions, Payouts, Recent activity, Repayments |
| **Section** | `SectionHeader` | Title (`subheading`) + optional "See all" link (48 dp) | |
| **SegmentedTabs** | `Segmented` | Full-width, 48 dp, `surfaceAlt` track, `surface` thumb that slides (settle) | Sinhala labels may wrap to 2 lines; height grows |
| **Chip** | `Chip` | 36 dp pill; selected = `primarySoft` + `primaryOnSoft` + check icon | `accessibilityState.selected` |
| **StatusPill** | `StatusPill` | Dot + word, semantic soft bg | Every status value translated |
| **Button** | `Button` | `primary` (gradient, `onHero` label), `secondary` (`primarySoft`), `tertiary` (text), `destructive` (`danger` outline) · sizes 56 (default) / 48 | Loading spinner replaces label, width fixed; disabled = 40 % opacity + not focusable |
| **Input** | `Input` | Label above · filled `surfaceAlt` field · `borderStrong` 1 px · helper/error line · optional prefix (Rs.) / suffix icon | Focus: 2 px `primary`; error: `danger` border + icon + message (never colour alone) |
| **PinPad** | new | 4–6 dots + 3×4 keypad (digits 28 sp, 72 dp keys), delete, optional fingerprint key | Haptic `selection` per key; wrong PIN shakes dots + message; never shows digits |
| **DateField** | new | Tap → bottom sheet with day / month / year wheels (Sinhala month names) | Used for date of birth (no free-text dates) |
| **BottomSheet** | new (Reanimated) | Grabber, title, content, primary action pinned | Backdrop tap and back button close; focus moves into the sheet |
| **Toast** | `ui/toast.tsx` | Icon + one line, bottom above tab bar, 3 s | Announced to TalkBack (`accessibilityLiveRegion`) |
| **EmptyState** | `EmptyState` | Illustration 120 + title + sentence + optional action | §3.6 |
| **ErrorState** | `ErrorView` | Illustration + "Couldn't load" + reason + Retry (secondary) | Offline variant uses the offline illustration |
| **StaleBanner / OfflineBanner** | `StaleBanner` | Slim `warningSoft` bar: "Showing saved information · updated 2 h ago" | Tap = retry |
| **Skeleton** | `Skeleton`, `SkeletonCards` | Shapes mirror the real layout per screen (hero, tiles, rows) | Shimmer off under reduced motion |
| **LoanProgress** | `ProgressBar` | Ring (72 dp) with % in the centre + "Rs X of Rs Y repaid" | Overdue ring = `danger`, else `success` |
| **NoticeCard** | `notices.tsx` card | Variants: `general` (megaphone, primary chip), `meeting` (date block "14 DEC" + time/place), `death` (memorial treatment §3.9). Collapsed: 3 lines of body + "Read more" | Tap → Notice detail |
| **DateBlock** | new | 48 × 56 tile: day (22, bold) over month (12) | Meetings, funerals, timeline |
| **MembershipCard** | `ui/MembershipCard.tsx` | Keep as is (22 Nov design) | Compact on Home, full on Card |
| **LargeQr** | `ui/LargeQr.tsx` | White sheet, QR 280 dp, name + member no., brightness up | Unchanged behaviour |
| **Avatar** | Home avatar | Initials on gradient, 40 / 64 dp | |
| **Illustration** | new | `src/ui/illustrations/*.tsx` inline SVG, inside an absolute-fill View where filled | §1.4 rule 4 |

Retired after migration: `Row` (→ `ListRow` / `DetailRow`), `Badge` (→ `StatusPill`), `Banner` (→ `StaleBanner` or inline `Notice`), `EmptyText` (→ `EmptyState` small variant), `Title`/`Subtitle` (→ `AppHeader`). Each is deleted, not left unused.

---

## 6. Screen-by-screen specifications

Format for every screen: **Purpose** (the question it answers) · **Layout** (wireframe;
matches the mockup where one exists) · **Content priority** · **States** · **Interactions** ·
**Copy** (new/changed keys; EN / SI) · **Accessibility** · **Acceptance criteria** (AC).
States always include: loading (skeleton shaped like the screen), empty, error (no data),
stale (error with cached data → `StaleBanner`), offline.

### 6.1 Auth

#### 6.1.1 Welcome — `(auth)/index.tsx` · mockup *Welcome*

**Purpose:** "What is this and how do I start?"

```
┌────────────────────────────────────┐
│▓▓ gradient (full screen) ▓▓  EN|සිං│
│▓▓                               ▓▓│
│▓▓          ┌────┐               ▓▓│
│▓▓          │ eS │  (white tile) ▓▓│
│▓▓          └────┘               ▓▓│
│▓▓   eSamithi වෙත සාදරයෙන්          ▓▓│
│▓▓   පිළිගනිමු                      ▓▓│
│▓▓   Your contributions, loans    ▓▓│
│▓▓   and notices in your pocket.  ▓▓│
│▓▓                               ▓▓│
│ ┌────────────────────────────────┐ │
│ │  [  පටන් ගන්න  ]  (white btn)   │ │
│ │  [ මට දැනටමත් PIN අංකයක් ඇත ]   │ │  secondary, outlined white
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

* Language toggle top-right, 48 dp, remembers choice.
* If a society is already resolved, show it under the subtitle: "Maranadhara Samithi · change".
* **AC:** (1) both buttons ≥ 56 dp, white button label `heroEnd` on white ≥ 4.5:1; (2) switching language re-renders all text without layout jump; (3) no text below 16 sp.

#### 6.1.2 Society code — `(auth)/samithi.tsx`

**Purpose:** "Connect me to my society."

* Large title "Connect your society"; one sentence on where the code comes from (office or member letter).
* **Code field:** auto-uppercase, auto-inserts the dash (`SAM-4217`), monospaced digits, example as placeholder; paste supported.
* Result appears as a **society confirmation card**: eS tile, society name (`heading`), "Is this your society?" + [Yes, continue] (primary) / [Use a different code] (tertiary).
* Errors inline under the field: unknown code, suspended society, network (with retry).
* **AC:** (1) typing `sam4217` shows `SAM-4217`; (2) result card announced to TalkBack; (3) keyboard never covers the primary button (`KeyboardAvoidingView`).

#### 6.1.3 Verify — `(auth)/verify.tsx`

**Purpose:** "Prove I am this member."

* Fields: **NIC** (auto-uppercase, accepts `123456789V` and 12-digit; inline format hint), **Date of birth** via `DateField` sheet (no typed dates).
* Copy explains why: "We check these against the society's records."
* Errors: "We couldn't find a member with this NIC and date of birth. Check them, or ask the society office."
* **AC:** (1) invalid NIC format blocks submit with a message; (2) DOB cannot be in the future; (3) 3 failures show the office contact.

#### 6.1.4 Set PIN — `(auth)/set-pin.tsx` · mockup *PIN*

* Step 1 "Choose a 4–6 digit PIN", step 2 "Enter it again" — on the `PinPad`, dots fill as you type; a "Continue" key appears from 4 digits.
* Mismatch: dots shake, "The two PINs didn't match. Try again."; returns to step 1.
* Then offer fingerprint unlock (if the device supports it): "Use your fingerprint next time?" [Yes] [Not now].
* **AC:** (1) PIN never visible; (2) keypad keys ≥ 72 dp; (3) works at 200 % font without the pad leaving the screen.

#### 6.1.5 Login — `(auth)/login.tsx` · mockup *PIN*

* Shows the remembered member (avatar initials, masked NIC `•••••567V`, society); "Not you?" switches member.
* `PinPad` with a fingerprint key when enabled; "Forgot PIN?" → explains the office reset and shows the office phone.
* Lockout message after the server's limit, with the time to wait.
* **AC:** (1) a remembered member never retypes their NIC; (2) wrong PIN feedback in < 300 ms after the response.

#### 6.1.6 Lock screen (biometric unlock on cold start)

* Gradient background, eS tile, "Unlock eSamithi", fingerprint prompt auto-shown; fallback "Use PIN".
* **AC:** cancelling the biometric prompt shows the PIN pad, never a blank screen.

### 6.2 Home — `(tabs)/index.tsx` · mockup *Home*

**Purpose:** Q1 "Am I OK?", then Q4 and Q3.

```
┌────────────────────────────────────┐
│▓ [eS] Maranadhara Samithi  (bell)(D)▓│  HeroHeader
│▓ ආයුබෝවන්, Demo                    ▓│  title 28
│▓ සාමාජික අංකය DEMO-001             ▓│  onHeroMuted
│▓┌──────────────────────────────┐ ▓│
│▓│ ✓  ඔබ යාවත්කාලීනයි             ›│ ▓│  StatusCard (ok/due/overdue)
│▓│    හිඟ මුදල් නැත                 │ ▓│
│▓└──────────────────────────────┘ ▓│
│╰──────────────────────────────────╯│
│  (id)    (!)      (dc)     (?)     │  QuickActions
│  කාඩ්පත  ගෙවිය යුතු  ඉල්ලීම්   උදව්    │
│ ┌──────────────┐ ┌──────────────┐  │
│ │↓ මුළු දායකත්වය│ │▢ ණය ශේෂය      │  │  StatTiles
│ │Rs 1,000,000  │ │Rs 999.00     │  │
│ └──────────────┘ └──────────────┘  │
│ නවතම නිවේදනය                  සියල්ල›│
│ ┌ NoticeCard (collapsed) ─────────┐│
│ [ membership card — compact ]      │
│ මෑත ගනුදෙනු                   සියල්ල›│
│ │22 │ මාසික දායකත්වය      +Rs 500   ││  TimelineRow ×5
└────────────────────────────────────┘
```

* **Status logic** (existing data, `useDues`): overdue loans → `overdue` "Rs X is overdue" (danger, sub-line "on N loan(s)"); fee unpaid → `due` "Your membership fee is due" (warning); else `ok` "You're up to date" (success).
* Hero amount count-up only on first load (§3.7).
* Bell → Notices with the unread count dot.
* Order below the hero: quick actions → summary tiles → latest notice → compact membership card → recent activity. Members open Home to check status and news first; the card is one tap away through its quick action.
* **States:** skeleton = hero block + 4 circles + 2 tiles + 3 rows; error = hero with name from cache if any + `ErrorState`.
* **AC:** (1) status visible without scrolling on a 360 × 640 dp screen at 100 % font; (2) every block is one tap to its detail; (3) staff see "Attendance" as the first quick action; (4) hero text ≥ 4.5:1 at every gradient stop.

### 6.3 My Money — `(tabs)/money.tsx` (new) · mockups *Money*, *Loans*

**Purpose:** Q2 "What have I paid, what do I owe?"

```
┌────────────────────────────────────┐
│ මගේ මුදල්                (large)   │  AppHeader
│ ┌ Dues banner (only when due) ────┐│  warningSoft/dangerSoft → Dues
│ │ ! Rs 2,450 is overdue        ›  ││
│ └─────────────────────────────────┘│
│ ┌──────────────┐ ┌──────────────┐  │  StatTiles: contributed · loan owed
│ └──────────────┘ └──────────────┘  │
│ [ දායකත්වය | ණය | ප්‍රතිලාභ ]        │  SegmentedTabs (?view=)
│ ── 2026 ─────── Rs 6,000 this year │  year header with total
│ නොවැම්බර්                          │  sticky month header
│ │22│ මාසික දායකත්වය     Rs 500.00 › │  TimelineRow
│ │05│ මරණාධාර දායකත්වය  Rs 250.00 › │
└────────────────────────────────────┘
```

* **Contributions view:** year headers with the year's total; sticky month headers; `TimelineRow` → Receipt; voided rows show a struck-through amount + "Voided" pill. `FlatList` (`ListScreen`).
* **Loans view:** one card per loan — status pill, issued date, **amount owed** (`heading`), `LoanProgress` ring, "Rs X of Rs Y repaid", next-step line ("Pay at the society office"). Closed loans collapse into "Repaid loans (3)" at the bottom.
* **Payouts view:** benefits paid to the member (`payouts.tsx` content) as `TimelineRow` with `arrow-up-circle`.
* Segment remembered per session; deep link `?view=`.
* **AC:** (1) the totals are the largest numbers on the screen; (2) switching segments keeps scroll position per segment; (3) a member with 10 years of contributions scrolls at 60 fps on a 2 GB phone.

#### 6.3.1 Dues — `dues.tsx` · mockup *Dues*

* `AmountHero` "Total overdue" (display, danger) or the all-clear illustration "You're up to date".
* Per overdue loan: card with loan number, `DetailRow`s Principal / Interest / Fines (each with its icon, not colour alone), [View loan].
* Membership fee due: card with explanation and the office contact.
* "How to pay" section: office address, hours and phone from `useSocietyInfo` (call button).
* **AC:** every amount labelled in words; the total equals the sum of the rows.

#### 6.3.2 Loan detail — `loan/[id].tsx` · mockup *Loan detail*

* Header card: status pill, issued date, `LoanProgress` ring, **owed** (`display`), original amount.
* Breakdown: Principal / Interest / Fines as three `DetailRow`s with icons; total row emphasised.
* Guarantors: avatar initials + name rows.
* **Repayments:** `TimelineRow` per payment — date block, "Repayment", amount (success, `+`); expand to see split (principal / interest / fine) **as a mini table**, not a run-on line (fixes A7). Tap → receipt.
* Loan terms: monthly interest, late fine.
* Migrated-loan note as an info callout, not italics.
* **AC:** no line of text contains more than one amount; the ring's % matches `repaidFraction`.

#### 6.3.3 Receipt — `receipt/[kind]/[id].tsx`

* Receipt "paper" card: eS tile + society name, receipt no., date; **amount** (`display`) first; then received from / NIC / type / method / months covered; for loan payments the allocation table; footer note.
* Actions: [Share receipt] (image, as Card does today) · voided receipts show a diagonal "VOIDED" band and no share.
* **AC:** amount is the first number read by TalkBack.

### 6.4 Notices — `(tabs)/notices.tsx` · mockup *Notices*

**Purpose:** Q3.

* Large title; filter chips All · Death · Meeting · General (counts in chips).
* `NoticeCard` list, newest first; death notices use the memorial treatment; meetings show a `DateBlock`; body collapsed to 3 lines.
* End of list footer: "Older notices are removed after a few weeks." (honest about auto-expiry, `5abcf016`).
* Opening the tab clears the badge (existing `markSeen`).
* **Empty:** illustration + "No notices right now. The society will post meetings and announcements here."
* **AC:** death and overdue never share a colour; a 20-notice list renders with `FlatList`.

#### 6.4.1 Notice detail — `notice/[id].tsx` (new) · mockup *Death notice*

* Death: memorial header band (no gradient), overline, **name** (`title`), "Member DEMO-118" if linked, funeral `DateBlock` + date in words + place (with a "Directions" tertiary button that opens maps search), full body.
* Meeting: date block, time/place, body, [Add to calendar] (tertiary, opens the system calendar intent).
* General: title, date, body.
* Share button (text share of title + key details).
* **AC:** opened from a push in ≤ 1 s after unlock; expired/hidden notice → list + toast.

### 6.5 Puruka — community exchange · mockups *Puruka*, *Post*

#### 6.5.1 Feed — `(tabs)/puruka.tsx`

* Header: title + tagline; search field; [Filters] chip opens a `BottomSheet` (type sell/wanted, category, price range, location) — the inline filter clutter moves into the sheet.
* Category chips row (horizontal scroll).
* Two-column grid of post tiles: photo 4:3 (placeholder illustration when none), title (2 lines), price (`subheading`, tabular) or "Wanted" pill, location + age caption. "Sold" overlay on sold posts.
* Floating **+ New post** button (56 dp, gradient) bottom-right above the tab bar; collapses to an icon on scroll.
* Load-more becomes infinite scroll with a footer spinner.
* **AC:** grid images lazy-load with fixed aspect boxes (no layout jump); filters show an active-count badge.

#### 6.5.2 Post detail — `puruka/[id].tsx`

* Full-width photo pager (dots), tap → `PhotoViewer`.
* Title (`heading`), price (`display` when selling), negotiable pill, category, location, posted/expires.
* Seller card: avatar, name, member since; actions **Call** (primary) and **WhatsApp** (secondary).
* Owner view: [Edit] [Mark sold] [Renew] [Delete (destructive, confirm sheet)].
* Report: tertiary "Report this post" → sheet with reasons.
* **AC:** Call/WhatsApp are reachable with one thumb (bottom-pinned bar).

#### 6.5.3 New / edit post — `puruka-new.tsx`

* **Stepper** (4 steps, progress at top): 1 Type (Sell / Wanted, two big cards) → 2 Photos (up to N, reorder) → 3 Details (title, category, description, location) → 4 Price & contact (price or budget, negotiable switch, phone) → Review & publish.
* Each step validates before Next; draft kept if the member leaves.
* **AC:** no step needs scrolling at 100 % font on 360 × 640; publish shows the success check and opens the new post.

#### 6.5.4 My posts — `puruka-mine.tsx`

* Segments Active · Sold · Expired; rows with thumbnail, price, status pill, expiry ("Expires in 3 days" warning); inline [Renew].

### 6.6 Me — `(tabs)/me.tsx` (replaces `more.tsx`) · mockup *Me*

```
┌────────────────────────────────────┐
│  (DM)  Demo Member                 │  Avatar 64 + name (heading)
│        DEMO-001 · eSamithi Demo... │
│        [ View profile ]            │
│ ┌ mini membership card → Card ───┐ │
│ My membership                       │
│  [id] Membership card           ›  │  [..] = Ionicons per §3.5
│  [pe] Profile                   ›  │
│  [dc] My requests         2 open › │
│  [gi] Benefits                  ›  │
│  [pp] Guarantees                ›  │
│ My society                          │
│  About · Society funds · Help       │
│ Staff tools (permission only)       │
│  [qr] Attendance                ›  │
│ App                                 │
│  Language          සිංහල | English  │
│  Appearance   System | Light | Dark │
│  Fingerprint unlock          (on)  │
│  My societies                  2 › │
│ [ Sign out ]          version 1.5.0 │
└────────────────────────────────────┘
```

* **AC:** every row ≥ 56 dp; "Sign out" asks for confirmation in a sheet; the staff section is absent (not disabled) without the permission.

#### 6.6.1 Profile — `profile.tsx`

* Header: avatar + name + member no.; sections **Personal** (NIC, DOB, gender, marital status, occupation, dependents), **Contact** (phone, address), **Bank** (bank, account holder, number masked `•••• 4821` with tap-to-reveal), **Membership** (joined).
* Footer callout: "Something wrong? Ask the office to update it" + [New correction request].
* **AC:** values never truncate — they wrap.

#### 6.6.2 Membership card — `card.tsx`

* Unchanged design (22 Nov). Tap QR → `LargeQr`; [Share card]; hint under the card. **AC:** existing behaviour kept.

#### 6.6.3 Requests / New request — `requests.tsx`, `new-request.tsx`

* List: cards with type icon, amount (loan requests), purpose, **status timeline** (Sent → Seen → Approved/Rejected → Done) instead of a lone pill; office note as a quoted callout.
* New request: choose type (two big cards: Loan / Correction) → form with helper text (amount with `Rs.` prefix and the society's maximum loan, purpose examples) → review → send; success check + "The office will reply here".
* **AC:** the max-loan figure comes from `useSocietyInfo`; the 3-pending limit is explained before the member types.

#### 6.6.4 Benefits — `benefits.tsx`

* Table-like list of benefit types with amounts (`useBenefitsSchedule`), each with an icon; intro sentence.

#### 6.6.5 Guarantees — `guarantees.tsx`

* Explanation callout ("You are a guarantor for these loans"); rows: borrower avatar + name, loan issued date, status pill.

#### 6.6.6 About the society — `society.tsx`

* Society header (eS tile, name, address); **Contact** card with [Call] [Directions]; **Loan terms** card (interest, late fine, max loan, guarantors required).

#### 6.6.7 Society funds — `society-funds.tsx`

* `AmountHero` total funds on a plain surface card (the gradient is reserved, §3.2); breakdown bar (cash vs fixed deposits) with legend; FD list (bank, amount, maturity `DateBlock`); note.

#### 6.6.8 Help — `help.tsx`

* Search-free FAQ as expandable rows ("How do I pay?", "How do I claim a benefit?", …), office contact card, About eSamithi (version).

#### 6.6.9 Settings rows (inside Me)

* Language: `SegmentedTabs` සිංහල | English (immediate). Appearance: System | Light | Dark. Fingerprint: switch (asks for PIN to enable). My societies: list with active check, [Add society] → society-code flow.

### 6.7 Staff attendance — `attendance/*` · mockup *Scanner*

#### 6.7.1 Events — `attendance/index.tsx`

* Intro callout (what staff can do), [New event] primary, event `ListRow`s with type icon, date block, present count pill.

#### 6.7.2 New event — `attendance/new.tsx`

* Type cards (Meeting / Funeral / Other), title, date chips (Yesterday / Today / Tomorrow), mode cards (Mark present / Mark absent) with one-line explanations; [Create].

#### 6.7.3 Scanner — `attendance/[id].tsx`

* Top: event title + present count pill; segmented Scan · Search · List.
* Scan: camera fills the area with a rounded viewfinder and corner marks, torch toggle (48 dp), last-result card slides up from the bottom: avatar initials, name, member no., result (Marked ✓ success / Already marked / Not a member card / Inactive) with [Undo] for own marks. Success haptic + short sound-free flash.
* Offline: `OfflineBanner` "N marks waiting to send".
* **AC:** existing behaviours (queue, duplicate protection, own-undo, keep-awake) unchanged; result card readable at arm's length (name 22 sp).

### 6.8 Global

| Element | Specification |
|---|---|
| Splash | Unchanged until phase 7 (native); phase 7: gradient + eS tile, matching Welcome |
| Tab badge | Notices: count in a `primary` badge ("9+" above nine). Never red: a badge is a count, not an alarm |
| Push landing | §4.4 |
| Update prompt (OTA) | Silent download; on next cold start apply. No modal. |
| Pull-to-refresh | Every data screen; `primary` spinner; `light` haptic on completion |
| Session expired | Sheet: "For your safety, please unlock again" → PinPad; data stays cached behind |
| Toasts | §5 Toast; max one at a time |
| Offline | `OfflineBanner` at the top of every data screen while offline; cached data shown |
| Keyboard | Every form screen uses `KeyboardAvoidingView`; primary button never hidden |

---

## 7. Human-centred interaction rules

1. **One primary action per screen.** Everything else is secondary or tertiary.
2. **Confirm only the irreversible** (sign out, delete post, report). Everything else acts immediately and offers **Undo** where possible (attendance mark, mark sold).
3. **Forgiving input:** auto-format society codes and NICs, accept spaces and lower case, never make a member type a date.
4. **Every error has a next step** (retry, call the office, check internet). No error codes on screen.
5. **Say what will happen** before a big action: "This sends your request to the society office. They will reply here."
6. **Respect a shared phone:** optional "hide amounts" (eye toggle on Home hero, remembered) — owner decision O2; the PIN/fingerprint lock stays.
7. **Respect grief:** no promotional or celebratory UI near a death notice; no confetti anywhere.
8. **Thumb reach:** primary actions in the bottom half on tall screens (pinned bars on Post detail, forms, Dues "How to pay").
9. **Never more than three taps** from Home to any money fact, the card, or the latest notice.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Contrast | All text ≥ 4.5:1, UI ≥ 3:1, both themes — enforced by `check-contrast.mjs` |
| Performance | 60 fps scroll on a 2 GB Android Go-class phone; `FlatList` for every unbounded list; images sized to their box |
| Start-up | Cold start to Home content (cached) ≤ 2.5 s on that phone; skeleton within 300 ms |
| OTA size | Each phase's update ≤ +400 KB over the current bundle (illustrations are SVG components, no bitmaps) |
| Font scale | Usable at 200 %; no clipped text; numbers may shrink to 0.75 |
| Screen reader | TalkBack reads every control in Sinhala when Sinhala is selected; logical order; hero status read first |
| Dark mode | Full parity; card and hero keep the brand blues |
| Offline | Every data screen renders cached data with the banner |
| Orientation | Portrait only (phase 7 marks `android.hardware.screen.portrait` not required so large-screen Play listing is unaffected) |

---

## 9. Delivery

All phases ship over the air on the `prod` channel to runtime `ea464a6c…` unless marked.
Before each publish: `npx eas fingerprint:compare --build-id 7fcd2176-b618-46a4-9fdc-6a906ab703e6`
must match. Each phase is independently shippable and leaves no half-styled screen.

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 · Approval** ✅ | This document + mockups | Approved 22 Nov 2026; §11 defaults taken |
| **P1 · Foundations** ✅ `4ffb4816` | Tokens v2 (`theme.tsx`), `display` size, `spacing.huge`; new components (§5) built and unused; illustrations; `check-tokens.mjs` | Gates green; no visible change to members |
| **P2 · Navigation + Home** ✅ `4ffb4816` | 5 tabs, `money` and `me` routes, redirects, TabBar v2, HeroHeader, StatusCard, QuickActions, StatTiles; push routing §4.4 | Every old route still opens; push → notice works on a real phone |
| **P3 · My Money** ✅ `5fa738fd` | Contributions / Loans / Payouts segments, Dues, Loan detail, Receipt | Screenshot matrix §10; amounts reconcile with web statement for the test member |
| **P4 · Notices + Puruka** ✅ `4ffb4816` (Notices) · `a8d3a83f` (Puruka) | NoticeCard variants, Notice detail, memorial treatment; Puruka feed/detail/new stepper/mine | Death notice reviewed by the owner on a phone |
| **P5 · Me + Auth** ✅ `d10fc68d` (Me) · `d6c74ead` (sign-in) | Me, Profile, Requests, Benefits, Guarantees, Society, Funds, Help, settings; Welcome, Society code, Verify (DateField), PinPad set/login, Lock screen | Full sign-up from a fresh install in Sinhala on a real phone |
| **P6 · Staff** ✅ `0914bb67` | Attendance events, new, scanner restyle | Scanner session of 20 cards at an event without regressions |
| **P7 · Binary (Play)** 🔄 built `3fd12ed9` — 1.6.0 vc10, runtime `f437a915…`; awaiting Play upload | Splash + adaptive icon matching Welcome; `uses-feature android.hardware.screen.portrait required=false`; optional native polish (e.g. blur on sheets) | New versionCode on Play; new runtime fingerprint; OTA lane re-pointed |

Sequencing: foundations first so screens only consume; navigation with Home because the
tab change is the biggest visible shift and Home is where members land; then by traffic.

---

## 10. Verification

* **Gates (CI + local):** `npx tsc --noEmit`; `node scripts/check-contrast.mjs` (new pairs); `check-motion.mjs`; `check-type.mjs` (adds 34); **new `check-tokens.mjs`** — fails on a hex colour, `fontSize`/`padding`/`margin`/`gap`/`borderRadius` literal in `src/app/**` (allow-list for the scanner viewfinder).
* **Screenshot matrix per phase** (Expo web harness with mocked hooks, then a real phone): Sinhala & English × light & dark × 360 & 412 dp × font scale 1.0 & 2.0, for every screen touched. Stored with the phase's commit notes.
* **Real Android sign-off** by the owner on the vc9 build after each OTA (web preview misses Android rendering bugs — see §1.4 rule 10).
* **TalkBack pass** in Sinhala on Home, My Money, Notices, PinPad.
* **Regression list:** sign-in/PIN/fingerprint, notices badge, card share, receipt share, Puruka post/edit/report, attendance queue/undo, multi-society switch, deep links via old routes.

---

## 11. Open decisions (each has a default)

| # | Decision | Default if not answered |
|---|---|---|
| O1 | **Sinhala tab words** — proposals: මුල් පිටුව · මගේ මුදල් · නිවේදන · පුරුක · මම. A Sinhala-reading officer should confirm | Ship the proposals |
| O2 | **"Hide amounts" toggle** on the Home hero for shared phones | Include, off by default |
| O3 | **Home quick actions** — Card · Dues · Request · Help (+ Attendance for staff) | As proposed |
| O4 | **Puruka as a tab** vs under Home | Keep as a tab (it is the most used social feature) |
| O5 | **Illustration style** — line two-tone (proposed) vs no illustrations | Line two-tone |
| O6 | **Notice detail sharing** (text share of a death notice) | Allowed, text only |

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Navigation change confuses existing members | Redirects keep old paths; a one-time, dismissible "What's new" sheet after P2 explains the five tabs in Sinhala |
| Android-only rendering bugs (gradients, SVG, elevation) | §1.4 rules; real-phone sign-off every phase |
| OTA lands on phones still on 1.4.0 | It cannot: OTA targets the vc9 runtime only; members on old builds keep the old UI until they update from Play |
| Scope creep into features | Features are frozen by D1; anything new goes to a separate requirement |
| Sinhala labels too long after copy changes | `check-type` + 360 dp screenshot at 200 % in the matrix |
| Performance on low-end phones (gradients, illustrations) | SVG count per screen ≤ 6; `FlatList`; measure on a 2 GB device in P3 |

---

## Appendix A · File map

| Area | Current | After |
|---|---|---|
| Tokens | `src/theme.tsx` | same file, palettes v2 (§3.2), `spacing.huge`, `type.display` |
| Components | `src/ui/index.tsx` (820 lines) | split: `src/ui/{layout,data,inputs,feedback,brand}.tsx` re-exported from `src/ui/index.tsx`; new `src/ui/illustrations/` |
| Tabs | `src/app/(tabs)/{index,puruka,contributions,loans,notices,more}.tsx` | `{index,money,notices,puruka,me}.tsx`; `contributions`, `loans`, `more` become redirects for one release |
| New screens | — | `src/app/notice/[id].tsx` |
| Push | `src/lib/push.ts` | + response listener and router |
| Gates | `scripts/check-{contrast,motion,type}.mjs` | + `scripts/check-tokens.mjs` |

## Appendix B · Contrast results (computed 22 Nov 2026)

Light: text/bg 14.09 · text/surface 15.26 · textMuted/bg 5.72 · textMuted/surface 6.20 · textMuted/surfaceAlt 5.83 · textSubtle/surface 3.60 · primary/surface 5.48 · primary/bg 5.06 · onPrimary/primary 5.48 · primaryOnSoft/primarySoft 6.37 · white/heroStart 5.48 · white/heroEnd 10.39 · onHeroMuted/heroStart 4.66 · success/soft 6.28 · warning/soft 5.62 · danger/soft 5.66 · memorial/soft 9.14 · borderStrong/surface 3.12.

Dark: text/bg 15.63 · text/surface 14.34 · textMuted/bg 8.14 · textMuted/surface 7.47 · textMuted/surfaceAlt 6.80 · textSubtle/surface 4.59 · primary/surface 6.08 · primary/bg 6.62 · onPrimary/primary 6.62 · primaryOnSoft/primarySoft 8.48 · white/heroStart 6.91 · white/heroEnd 12.84 · onHeroMuted/heroStart 4.89 · success/soft 8.82 · warning/soft 9.41 · danger/soft 5.94 · memorial/soft 9.85 · borderStrong/surface 3.44.

## Appendix C · i18n keys (new or changed; EN / SI, SI to be reviewed by the owner)

| Key | EN | SI |
|---|---|---|
| `mob.tabMoney` | My Money | මගේ මුදල් |
| `mob.tabMe` | Me | මම |
| `mob.tabNotices` (changed) | Notices | නිවේදන |
| `mob.statusOk` | You're up to date | ඔබ යාවත්කාලීනයි |
| `mob.statusOkSub` | Nothing is overdue | හිඟ මුදල් නැත |
| `mob.statusOverdue` | {amount} is overdue | {amount} ක් හිඟයි |
| `mob.statusFeeDue` | Your membership fee is due | ඔබේ සාමාජික ගාස්තුව ගෙවිය යුතුයි |
| `mob.moneyContrib` / `mob.moneyLoans` / `mob.moneyPayouts` | Contributions / Loans / Payouts | දායකත්වය / ණය / ප්‍රතිලාභ |
| `mob.yearTotal` | {amount} in {year} | {year} දී {amount} |
| `mob.repaidOf` | {paid} of {total} repaid | {total} න් {paid} ක් ගෙවා ඇත |
| `mob.howToPay` | How to pay | ගෙවන ආකාරය |
| `mob.noticesExpireNote` | Older notices are removed after a few weeks. | පැරණි නිවේදන සති කිහිපයකට පසු ඉවත් වේ. |
| `mob.noticeGone` | This notice is no longer shown | මෙම නිවේදනය තවදුරටත් පෙන්වන්නේ නැත |
| `mob.meMembership` / `mob.meSociety` / `mob.meStaff` / `mob.meApp` | My membership / My society / Staff tools / App | මගේ සාමාජිකත්වය / මගේ සමිතිය / කාර්ය මණ්ඩල මෙවලම් / යෙදුම |
| `mob.hideAmounts` | Hide amounts | මුදල් සඟවන්න |
| `mob.whatsNewTabs` | The app now has five tabs. Money is all in one place. | යෙදුමේ දැන් ටැබ් පහක් ඇත. ඔබේ මුදල් සියල්ල එකම තැනක. |

`mob.tabContributions`, `mob.tabLoans`, `mob.tabMore` are removed with the P2 redirects' retirement.
