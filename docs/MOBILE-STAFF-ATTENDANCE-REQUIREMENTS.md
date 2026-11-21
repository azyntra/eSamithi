# Mobile Staff Attendance — Requirements & Plan

**Status:** Built 16 November 2026 — not yet deployed or released (see §14) · **Date:** 15 November 2026 · **Owner:** Sachira
**Applies to:** `server/` (API 1.1.0 → 1.2.0), `web/` (office web app), `mobile/` (eSamithi Member 1.4.0 → 1.5.0)
**Depends on:** `MEMBER-MOBILE-APP-REQUIREMENTS.md` (member app), `ESAMITHI-WEB-APP-REQUIREMENTS.md` (office app), the existing Attendance Register (`server/routes/events.routes.js`, migration 007 + 013)

---

## 0. Summary

Today attendance is marked only in the office app: an officer creates an event and scans
members' membership-card QR codes with a USB scanner, or types society IDs. That works for a
meeting in the society hall. It does not work at a funeral house, where there is no computer.

This feature lets the office nominate trusted members as **attendance staff**. A nominated
member sees a new **Mark Attendance** screen in their eSamithi mobile app and can scan other
members' QR cards with the phone camera. Everyone else's app is unchanged, and the camera
scanner is never visible to ordinary members.

The main decisions, each explained in the sections below:

| # | Decision | Why |
|---|---|---|
| D1 | "Staff" is a flag on a **member record**, set from the office app | Reuses the member app's existing sign-in; no second login or account type in the app |
| D2 | The server checks the flag **on every request**, not from the login token | Removing someone's staff status takes effect immediately |
| D3 | Mobile staff can **create events and mark attendance**; deleting events and changing the marking method stay office-only | A funeral is often announced when the office is closed; destructive actions stay with officers |
| D4 | Mobile marking is allowed only for events dated **yesterday, today or tomorrow** | Limits what a lost phone or a mistake can alter; old registers stay frozen |
| D5 | The QR code stays the **plain society ID** in version 1 | Works with every card already in members' phones and with the office USB scanners |
| D6 | **Manual search** and **printed QR cards** are both part of version 1 | Some members have no smartphone; they will carry a printed card, and search covers anyone without one |
| D7 | Version 1 needs a connection; **offline scanning** is a follow-up, but the API is shaped for it now | Village funeral houses have poor signal, but offline sync roughly doubles the work |
| D8 | Requires a **new app binary** from Google Play (camera is a native capability) | Cannot be delivered by an over-the-air update |
| D9 | Office **Administrators and Staff** can grant or remove the permission; View-only users cannot | Owner decision: day-to-day officers manage this, not only the administrator |
| D10 | Tapping the QR on the member's card opens a **large, plain QR view** (code, name, society ID only) | Faster, more reliable scanning at arm's length |

---

## 1. Goals and non-goals

### Goals
- G1. An officer can mark a member as attendance staff, and remove it, from the office app.
- G2. A staff member can mark attendance for an event from their phone by scanning QR cards.
- G3. Marks made on phones and marks made in the office land in the **same register**, live, with no duplicates.
- G4. Every mark records **who made it and from where**, so a disputed fine can be traced.
- G5. Ordinary members never see the scanner or any other member's attendance.
- G6. Every member can be scanned: from a large QR on their phone, or from a printed card.

### Non-goals (this release)
- Collecting money or recording payments from the phone.
- Members checking themselves in (see option O4 in §9).
- Automatic fines for absence. The existing CSV export remains the input for fines.
- iOS release. The configuration is prepared, but only Android ships.

---

## 2. People and terms

| Term | Meaning |
|---|---|
| **Office user** | A login in the office app (`users` table): Administrator, Staff or View only. Unchanged by this feature. |
| **Member** | A society member who signs in to the mobile app with NIC + PIN. |
| **Attendance staff** | A **member** whom the office has granted permission to mark attendance in the mobile app. New. |
| **Event** | A meeting, funeral or other occasion in the Attendance Register (`society_events`). |
| **Mark** | One row in `event_attendance`: a member recorded against an event. |

> The word "staff" already means an office role. To avoid confusion, the office app labels the
> new permission **"Attendance staff (mobile app)"**, and this document always says
> *attendance staff*.

An office user who is not also a society member cannot use this feature, because the mobile
app has no office-user login (see option O2 in §9). In practice committee members are members.

---

## 3. User stories

1. As the **secretary**, I open a member in the office app and switch on "Attendance staff",
   so that he can mark attendance at tomorrow's funeral.
2. As **attendance staff**, I open my app at the funeral house, choose (or create) the event,
   and scan each arriving member's card. I hear and feel a confirmation and see the name, so I
   do not need to look at the phone for long.
3. As attendance staff, when an elderly member has no phone, I search his name or type his
   society ID and mark him.
4. As attendance staff, when I scan the wrong person, I undo it.
5. As the **treasurer**, back in the office, I open the event and see everyone marked, who
   marked them, and whether it came from a phone, and I export the list.
6. As the secretary, when a committee member steps down, I switch the permission off and his
   app loses the screen straight away.
7. As a **member**, I tap the QR code on my card and it fills the screen with just the code,
   my name and my society ID, so the scanner reads it at once.
8. As the secretary, I print QR cards for the members who have no smartphone and hand them
   out at the next meeting.

---

## 4. Functional requirements

Priority: **M** = must (version 1), **S** = should (version 1 if time allows), **C** = could (later).

### 4.1 Managing attendance staff — office web app

| ID | Requirement | Pri |
|---|---|---|
| FR-1.1 | Member page → **Mobile app** tab shows an "Attendance staff (mobile app)" switch with the date it was granted and by whom. | M |
| FR-1.2 | **Administrators and Staff** can change it. **View-only** users see the state read-only. (Enabling/disabling app access and resetting a PIN stay administrator-only, as today.) | M |
| FR-1.3 | The switch can be set before the member has installed the app; it takes effect when they sign in. The tab says so when the member has no PIN yet. | M |
| FR-1.4 | Granting is refused for an inactive member or one whose app access is disabled. Disabling app access or deactivating a member **also removes** the permission. | M |
| FR-1.5 | Attendance page gets a **"Mobile staff"** panel: the list of current attendance staff (name, society ID, phone, app set up or not, last used), an "Add" member picker, and "Remove" per row. | M |
| FR-1.6 | Members list shows a small badge on attendance staff. | S |
| FR-1.7 | When the permission is granted, the member receives a push notification: "You can now mark attendance in eSamithi." | S |
| FR-1.8 | Every grant and removal is written to an audit trail (who, whom, when), and the Mobile staff panel shows who granted each one. This matters more now that Staff can grant it. | M |
| FR-1.9 | A samithi-level setting **"Allow attendance marking from the mobile app"** (default on). When off, the feature is hidden for the whole society and the API refuses it. | S |

**Desktop app.** The desktop application from 1.3.8 is a shell around the web app, so it gets
these screens automatically: the permission is managed from the web UI and the desktop UI
alike. The older native desktop (1.3.7 and earlier) will not show them; offices still on it
should update the desktop app or use the web app. No separate native desktop work is planned.

### 4.2 Seeing the feature — mobile app

| ID | Requirement | Pri |
|---|---|---|
| FR-2.1 | The app learns the permission from the member's profile (`permissions: ["attendance"]`), refreshed on sign-in, on app foreground and on pull-to-refresh. | M |
| FR-2.2 | Attendance staff see a **"Mark Attendance"** entry in Home → Quick actions and in the More tab. Members without the permission see nothing: no entry, no disabled button, no camera prompt. | M |
| FR-2.3 | If the permission is removed while the screen is open, the next action shows "You no longer have permission to mark attendance" and returns to Home. | M |
| FR-2.4 | The permission is per samithi. A member of two societies may be staff in one and not the other; switching samithi updates the menu. | M |

### 4.3 Events on the phone

| ID | Requirement | Pri |
|---|---|---|
| FR-3.1 | The Mark Attendance screen lists **open events**: those dated yesterday, today or tomorrow, newest first, with type, title, date, marking method and present count. | M |
| FR-3.2 | *(Confirmed.)* Staff can **create an event**: type (Meeting / Funeral / Other), title, date (defaults to today; only yesterday–tomorrow allowed), marking method (defaults to "Mark those present"). | M |
| FR-3.3 | When a death notice or meeting notice exists for today or tomorrow, "Create event" offers it as a one-tap suggestion that fills in the type, title and date. | C |
| FR-3.4 | Staff **cannot** delete events or change an event's marking method from the phone. | M |
| FR-3.5 | *(Confirmed: yesterday, today, tomorrow.)* Events outside the open window are not listed and the API refuses marks for them (D4). | M |

### 4.4 Scanning and marking

| ID | Requirement | Pri |
|---|---|---|
| FR-4.1 | Opening an event shows a live camera scanner that reads QR codes continuously; staff do not press a button per scan. | M |
| FR-4.2 | The first use asks for camera permission with a plain explanation. If refused, the screen explains how to enable it and offers "Open settings"; manual marking (FR-4.8) still works. | M |
| FR-4.3 | After each scan the app shows a result card for about two seconds and gives distinct feedback: **marked** (green, success haptic and tone, name and society ID in large type), **already marked** (amber, with the time and who marked), **not found** (red), **inactive member** (amber warning; the mark is still recorded, as the office app does today — confirmed). | M |
| FR-4.4 | The same code is ignored for 3 seconds after a scan, so holding a card in view does not fire repeatedly. | M |
| FR-4.5 | A torch (flashlight) button, for evening funerals. | M |
| FR-4.6 | A running count: "37 present · 12 scanned by you". | M |
| FR-4.7 | **Undo**: the result card has an Undo button, and staff can remove any mark **they made themselves** from the list. They cannot remove marks made by others or by the office. | M |
| FR-4.8 | **Manual marking**: a search box finds active members by name or society ID; tapping one marks them after a confirmation showing the name. | M |
| FR-4.9 | A **roster** view with Present and Absent tabs and search. It shows name and society ID only, never NIC or phone number. | M |
| FR-4.10 | Events recorded by the "Mark absentees" method open on the roster and manual search rather than the camera, since absent members are not there to be scanned. Scanning still works and marks the member absent, with wording that makes this obvious. | M |
| FR-4.11 | The screen stays awake while the scanner is open. | S |
| FR-4.12 | Staff may mark themselves. | M |
| FR-4.13 | Several staff, and the office USB scanner, can mark the same event at the same time. A second attempt on the same member reports "already marked" and creates nothing. | M |
| FR-4.14 | A QR code that is not a society ID (a web link, another app's code) is reported as "Not an eSamithi card" without calling the server. | M |

### 4.5 The member being scanned

| ID | Requirement | Pri |
|---|---|---|
| FR-5.1 | The existing Membership Card screen stays as it is, and its QR code becomes tappable. | M |
| FR-5.2 | **Large QR view.** Tapping the QR code on the Membership Card opens a full-screen view showing **only** the QR code, the member's name and the society ID. Nothing else: no card artwork, no society branding, no buttons except close. | M |
| FR-5.3 | In the large view the QR is as big as the screen allows (about 80% of the screen width, never less than 60 mm on the glass), black on a pure white background **in both light and dark themes**, with a clear white margin around it. | M |
| FR-5.4 | Name and society ID sit under the code in large type (society ID at least 24 pt, name at least 20 pt, Sinhala names wrap rather than truncate). | M |
| FR-5.5 | The large view closes on a tap anywhere, the back button, or a swipe down. | M |
| FR-5.6 | A small "tap to enlarge" hint under the QR on the card screen, so members discover it. | S |
| FR-5.7 | The large view raises screen brightness to maximum while open and restores the previous level on closing; the screen stays awake. | S |
| FR-5.8 | The compact card on Home keeps opening the Membership Card screen (unchanged); the large view is one more tap from there. | M |
| FR-5.9 | Members can see **their own** attendance history (event, date, present or absent). | C |

FR-5.2 to FR-5.6 need no native capability, so they can reach members on the **current app
(1.4.0) by over-the-air update**, before the new binary. Only the brightness boost (FR-5.7)
waits for 1.5.0. This means every member has the large QR ready by the time staff start scanning.

### 4.6 Office register changes

| ID | Requirement | Pri |
|---|---|---|
| FR-6.1 | The roster shows **who marked** each member and a "Mobile" badge for marks made in the app. | M |
| FR-6.2 | The attendance CSV export gains "Marked by" and "Source" columns. | M |
| FR-6.3 | The event list shows who created each event when it was created from a phone. | S |
| FR-6.4 | The office roster refreshes on its own every 15 seconds while an event is open, so officers can watch a phone-marked event fill in. | S |
| FR-6.5 | Changing an event's marking method still clears all marks, including phone marks; the existing warning states the count. | M |

### 4.7 Members without a smartphone — printed QR cards

Confirmed by the owner: some members will use a printed copy of their QR code. This moves
into version 1. It is office-app work only and needs no app release.

| ID | Requirement | Pri |
|---|---|---|
| FR-7.1 | Manual marking (FR-4.8) remains available for anyone with neither phone nor card. | M |
| FR-7.2 | **Print one card**: Member page gets a "Print QR card" action. | M |
| FR-7.3 | **Print many**: Member Registry gets "Print QR cards" with a choice of **all active members**, **members who have not set up the app** (the same group as "Not set up" in the App Usage report), or **selected members**. | M |
| FR-7.4 | Card content: society name, member's full name (wrapped, never cut off), membership number, NIC, phone number, and the QR code. No address, date of joining or bank details. NIC and phone were added on 21 November 2026 at the societies' request, so the card also serves as a member ID. | M |
| FR-7.5 | Card layout: standard ID-card size (85.6 × 54 mm), ten per A4 sheet with light cut lines, QR at least 30 mm square with a white margin, printed black on white so photocopies still scan. | M |
| FR-7.6 | The printed QR carries exactly the same content as the QR in the app, so phone scanners and office USB scanners read both without knowing the difference. | M |
| FR-7.7 | Opens in the existing print preview; prints in the officer's chosen language; unnamed members print with their society ID only. | M |
| FR-7.8 | QR codes are generated in the browser; no member data is sent to any outside service. | M |
| FR-7.9 | Reprinting is always allowed (a lost card is simply printed again). A lost card needs no cancellation in version 1, because the code is only a lookup key and the scanner shows the name for the staff member to check. | M |
| FR-7.10 | A larger "poster" option: one member per A5 page with a 70 mm QR, for members with poor eyesight or shaky hands. | C |

---

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Speed.** A scan shows its result within 1 second on a normal 4G connection. A practised operator should manage 20 members a minute. |
| NFR-2 | **Poor connection.** If a mark cannot reach the server, the app says so clearly, keeps the scan in a short pending list on screen, and retries automatically. It never shows "marked" for something the server has not confirmed. |
| NFR-3 | **Security.** Permission is enforced on the server for every call (§7.3). Hiding the menu is not the control. |
| NFR-4 | **Privacy.** The phone receives only names and society IDs of members. Camera frames are processed on the device and never stored or uploaded. |
| NFR-5 | **Languages.** Every new string in English and Sinhala, in the mobile app and the office app. |
| NFR-6 | **Accessibility.** Results are conveyed by colour, icon, text and haptic together, never colour alone; text meets the app's existing size rules for Sinhala. |
| NFR-7 | **Compatibility.** Older app versions keep working and simply do not show the feature. Office USB scanners and existing cards keep working unchanged. |
| NFR-9 | **Scan reliability.** A phone showing the large QR view, and a printed card, must both scan in under one second at 20–40 cm in indoor light on a mid-range Android phone. Printed codes use a medium error-correction level so a creased or slightly worn card still reads. |
| NFR-8 | **Battery and heat.** The camera stops when the screen is left or the app goes to the background. |

---

## 6. Screens (mobile)

```
More / Home quick action
        │  (only if permissions includes "attendance")
        ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│ Mark Attendance          │      │ New event                │
│                          │  +   │ Type  [Meeting|Funeral|…]│
│ ● Funeral — K. Perera    │ ───▶ │ Title [______________]   │
│   Today · 37 present     │      │ Date  [15 Nov 2026]      │
│ ○ Monthly meeting        │      │ Method(•)Present ( )Absent│
│   Tomorrow · 0 present   │      │        [ Create ]        │
└───────────┬──────────────┘      └──────────────────────────┘
            ▼
┌──────────────────────────┐
│ Funeral — K. Perera   ⚡ │  ⚡ torch
│ ┌──────────────────────┐ │
│ │                      │ │
│ │     camera view      │ │
│ │      ┌──────┐        │ │
│ │      │  QR  │        │ │
│ │      └──────┘        │ │
│ └──────────────────────┘ │
│ ✅ Nimal Perera · S-042  │  result card (2 s) + [Undo]
│ 37 present · 12 by you   │
│ [ Search member ] [List] │
└──────────────────────────┘
```

Member's side — the large QR view (FR-5.2):

```
┌──────────────────────────┐        ┌──────────────────────────┐
│ Membership card          │        │                          │
│ ┌──────────────────────┐ │  tap   │   ██████████████████     │
│ │ Samithi name         │ │  QR    │   ██              ██     │
│ │ Nimal Perera   ▓▓▓▓  │ │ ─────▶ │   ██   large QR   ██     │
│ │ S-042          ▓▓▓▓  │ │        │   ██              ██     │
│ └──────────────────────┘ │        │   ██████████████████     │
│   tap the code to enlarge│        │                          │
│ [ Share card ]           │        │        S-042             │
└──────────────────────────┘        │     Nimal Perera         │
                                    └──────────────────────────┘
                                     white background, max brightness
```

---

## 7. Technical design

### 7.1 Data model — migration 018 (additive only)

```sql
ALTER TABLE members
  ADD COLUMN app_staff_attendance   TINYINT   NOT NULL DEFAULT 0,
  ADD COLUMN app_staff_granted_at   TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN app_staff_granted_by   INT       NULL DEFAULT NULL;   -- users.id

ALTER TABLE event_attendance
  ADD COLUMN marked_by_member_id INT         NULL DEFAULT NULL,    -- set for mobile marks
  ADD COLUMN source              VARCHAR(10) NOT NULL DEFAULT 'office',  -- 'office' | 'app'
  ADD COLUMN client_ref          CHAR(36)    NULL DEFAULT NULL;    -- follow-up: offline dedupe

ALTER TABLE society_events
  ADD COLUMN created_by_member_id INT NULL DEFAULT NULL;

CREATE TABLE member_staff_events (            -- audit trail for FR-1.8
  id INT PRIMARY KEY AUTO_INCREMENT,
  member_id INT NOT NULL, action VARCHAR(10) NOT NULL,   -- 'grant' | 'revoke'
  by_user_id INT NULL, reason VARCHAR(40) NULL,          -- e.g. 'app_disabled'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mse_member (member_id, created_at)
);
```

Notes:
- `marked_by` keeps meaning "office user id"; a mobile mark leaves it NULL and fills
  `marked_by_member_id`. Existing rows need no backfill (`source` defaults to `office`).
- A single column is enough for one permission. If more mobile permissions arrive (for
  example collecting payments), move to a `member_app_permissions` table then; the profile
  field is already a list, so the app will not need to change shape.
- Setting key `app_attendance_enabled` (`'1'`) for FR-1.9, inserted with `INSERT IGNORE`.

### 7.2 API

**Shared rules first.** The marking logic moves out of `events.routes.js` into
`server/lib/attendance.js` (`markMember`, `unmarkMember`, `listEvents`, `getRoster`), so the
office routes and the new member routes cannot drift apart.

Office (existing `authMiddleware`):

| Method & path | Change |
|---|---|
| `PUT /members/:id/app-staff` | New. `{ attendance: 0 \| 1 }`. Allowed for **Administrator and Staff** roles (View-only is already refused for every write). Applies FR-1.4, writes the audit row, sends the push. Kept separate from `app-access`, which stays administrator-only. |
| `GET /members/app-staff` | New. List for the "Mobile staff" panel, including who granted each. |
| `GET /members/qr-cards?scope=all\|not_enrolled&ids=` | New. Minimal rows for card printing: `{ id, society_id, full_name }` only. |
| `GET /events/:id/attendance` | Each marked row adds `marked_by_name` and `source`. |

Member app (existing `memberAuthMiddleware` + new `requireAttendanceStaff`), all under `/api/v1/me/attendance`:

| Method & path | Purpose |
|---|---|
| `GET /me/profile` | Adds `permissions: string[]`. |
| `GET /me/attendance/events` | Open events (window D4) with present counts. |
| `POST /me/attendance/events` | Create `{ type, title, event_date, attendance_mode }`; date must be inside the window. |
| `GET /me/attendance/events/:id` | Event + `present[]` + `absent[]`, each `{ member_id, society_id, full_name, marked_at, marked_by_name, mine }`. No NIC, no phone. |
| `GET /me/attendance/members?q=` | Manual search: active members by name or society ID, max 20, `{ member_id, society_id, full_name }`. |
| `POST /me/attendance/events/:id/marks` | `{ society_id \| member_id, client_ref?, scanned_at? }` → `{ member, already, marked_at, marked_by_name }`. Idempotent. |
| `DELETE /me/attendance/events/:id/marks/:memberId` | Only when `marked_by_member_id` is the caller. |
| `POST /me/attendance/events/:id/marks/batch` | Follow-up (offline scanning): up to 200 queued scans, per-item results. |

Error codes the app relies on: `403 NOT_STAFF`, `403 FEATURE_OFF`, `409 EVENT_CLOSED`,
`404 MEMBER_NOT_FOUND`, `404 EVENT_NOT_FOUND`.

### 7.3 Authorisation

- The member token is unchanged (`typ: 'member'`). **No permission claim is put in the token**;
  `requireAttendanceStaff` reads `app_staff_attendance`, `is_active` and `app_enabled` from the
  database on each call. Cost is one indexed lookup; benefit is instant revocation (D2).
- Rate limit: 120 marks per minute per member, 20 event creations per day per member.
- The QR scanner cannot be reached by tampering with the app: without the flag every
  `/me/attendance/*` call returns `403 NOT_STAFF`.

### 7.4 QR payload

Version 1 keeps the payload as the plain society ID (D5). Known limits, accepted for now:

- **A card can be shown by someone else** (a screenshot sent to a friend). The control is
  human: the scanner shows the name in large type and the staff member is looking at the
  person. This is the same trust level as the paper book it replaces.
- **Two societies may use the same society ID.** A card from another samithi would mark the
  local member with that ID. Risk is low (the person must be physically present at the wrong
  society's event) and the name shown will not match.

Follow-up option, backward compatible: cards encode `esm1:<samithi-slug>:<society-id>`; every
scanner (phone, office) accepts both forms and rejects a mismatched slug. A further step, a
signed code that changes every minute, defeats screenshots but breaks printed cards, so it
is not recommended.

### 7.5 Mobile implementation notes

- **Camera:** `expo-camera` (`CameraView` with QR-only barcode settings). Check the SDK 57
  API in the Expo docs at build time rather than relying on memory. This is a native module,
  so the app's runtime fingerprint changes and a **new binary** is required (D8).
- **Also bundle in the same binary** (so no second store release is needed):
  `expo-keep-awake` (FR-4.11), `expo-brightness` (FR-5.7), and local storage for the follow-up
  offline queue.
- **Android:** `CAMERA` permission via the `expo-camera` config plugin with a Sinhala/English
  rationale. **iOS:** `NSCameraUsageDescription`.
- New route `mobile/src/app/attendance/` (event list, new event, scanner, roster), guarded by
  the permission; hooks in `api/hooks.ts`; about 45 new `mob.att*` strings per language.
- **Large QR view:** a modal on `card.tsx` using the QR library already in the app
  (`react-native-qrcode-svg`), always black on white regardless of theme. JS-only, so it can
  go out by OTA to 1.4.0; the brightness call is added behind a capability check in 1.5.0.
- Worklets rule from the Puruka incident applies: no non-worklet helpers on the UI thread.

### 7.6 Printed cards (office web app)

- A QR generator is added to `web/` and loaded only when a print is requested, so it does
  not add to the first page load. Codes are drawn as vector graphics so they print sharply.
- A new print template beside the receipt and report templates builds the A4 sheet; it
  reuses the existing print preview and bundled fonts (Sinhala names print correctly).
- Batch printing of a whole society is a few hundred small vector codes; it is generated in
  pages to keep the browser responsive.

### 7.7 Offline scanning (later phase design, not built in version 1)

1. Opening an event while online downloads the active roster (society ID → name), small
   enough to hold in memory and on disk for a society of a few hundred members.
2. Scans made with no connection are validated against that roster, shown as
   "Saved on this phone" (a distinct grey state), and stored with a `client_ref` and
   `scanned_at`.
3. When the connection returns, the queue is sent to the batch endpoint. The unique key on
   (event, member) and `client_ref` make re-sending harmless.
4. The event screen shows "5 waiting to send" until the queue is empty, and warns before the
   member signs out with unsent scans.

---

## 8. Dependencies

| Area | Dependency | Owner |
|---|---|---|
| Server | Migration 018; deploy API **before** the app is released. Old apps are unaffected. | Dev |
| Office web app | Mobile-app tab switch, Mobile staff panel, roster columns, CSV columns, printed QR cards (new QR generator dependency, new print template), ~35 strings ×2 languages. Ships by the normal web deploy. | Dev |
| OTA update | Large QR view to app 1.4.0 on the `prod` channel; run the runtime fingerprint check first. | Dev |
| Office printer | Any A4 printer. Card stock or lamination is the society's choice; plain paper scans fine. | Society |
| Mobile binary | New EAS production build (versionCode 8, version 1.5.0). OTA cannot deliver it. Run the fingerprint check before any later OTA. | Dev |
| Google Play | Camera permission appears in the listing; update the **Data safety** form (camera used on-device, nothing collected); new release notes. | Owner |
| Play review | The reviewer's demo member (samithi DEM-9361, NIC 901234567V) **must be flagged as attendance staff** and a demo event must exist, or the reviewer cannot reach the camera feature. Version 7 was rejected for exactly this kind of access problem. | Owner + Dev |
| Privacy policy | Add a sentence to `api.esamithi.com/privacy/`: the camera is used only to scan membership QR codes; images are not stored. | Dev |
| Feature guide | Add the feature to `docs/ESAMITHI-FEATURE-GUIDE.html` after release. | Dev |
| Push | Uses the existing Expo push pipeline for FR-1.7; no new setup. | — |
| Training | One-page instruction for attendance staff (Sinhala): open event, scan, undo, manual search. | Owner |
| Hardware | None. Any Android phone with a rear camera. | — |

---

## 9. Options considered

| # | Option | Verdict |
|---|---|---|
| O1 | **Flag on the member record; scanner inside the member app** | **Chosen.** One app, one sign-in, managed from the office. |
| O2 | Let office users (username + password) sign in to the mobile app | Rejected for now. Needs a second sign-in flow, role handling and session rules in the app, and most committee members are members anyway. |
| O3 | Use the office **web app on the phone's browser** with a camera scanner | Possible fallback with no store release, but browser QR scanning is unreliable on older Android phones and the office app is not laid out for phones. Not pursued. |
| O4 | **Self check-in**: staff display an event QR, each member scans it with their own app | Attractive (no queue at the door) but members without phones are excluded and a photo of the code lets absent members check in. Could be added later with a code that changes every 30 seconds. |
| O5 | Dedicated handheld scanners | Rejected: cost and logistics; phones already exist. |
| O6 | Permission tiers (create events / mark only) | Deferred. One permission in version 1; the setting in FR-1.9 is the only switch. |

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Poor signal at funeral houses makes scanning frustrating | NFR-2 pending list and retry in version 1; offline mode as a follow-up (§7.7; design ready, storage already in the binary). |
| A staff member marks absent friends as present | Every mark names its marker (FR-6.1); the three-day window (D4); office can remove any mark; permission is easy to withdraw. |
| Lost or shared staff phone | App PIN/biometric; office disables app access, which also removes the permission. |
| QR will not scan on cracked or dim screens | Large QR view with brightness boost (FR-5.2–5.7); printed card as a spare; manual search (FR-4.8). |
| Printed cards get lost, lent or photocopied | Same trust level as the phone QR: the scanner shows the name and the staff member looks at the person. Reprint freely (FR-7.9). |
| Office Staff grant the permission too freely | Audit trail and "granted by" shown in the Mobile staff panel (FR-1.8); administrators can remove any grant. |
| Play review rejection | Demo account prepared as staff (§8); camera rationale text; data safety form updated before submission. |
| Members on old app versions | They are only ever *scanned*, which needs no update. Only staff need 1.5.0. |
| Marking method confusion ("absent" mode) on a phone | FR-4.10 wording and defaulting phone-created events to "present". |

---

## 11. Delivery plan

| Phase | Contents | Notes |
|---|---|---|
| **1 — Server + office** | Migration 018, shared attendance library, staff management API, member attendance API, office switch + Mobile staff panel + roster/CSV changes, **printed QR cards**, tests | Ships without any app change. Printed cards are usable immediately with the office USB scanner |
| **1b — OTA to app 1.4.0** | **Large QR view** on the Membership Card (FR-5.2–5.6) | No store release; reaches members before scanning starts |
| **2 — Mobile 1.5.0** | Permission in profile, Mark Attendance screens, scanner, manual search, roster, undo, torch, keep-awake, brightness boost on the large QR view, strings | New binary; internal testing track first with two real staff phones |
| **3 — Release** | Play data-safety + privacy text, demo account prepared, production rollout, training sheet | Staged rollout 20% → 100% |
| **4 — Follow-ups** | Offline scanning (§7.7), samithi-prefixed QR (§7.4), own attendance history (FR-5.9), notice-to-event suggestion (FR-3.3), poster-size cards (FR-7.10) | Each independent |

---

## 12. Acceptance criteria (version 1)

1. An Administrator **or a Staff user** switches a member to attendance staff in the office
   app; within one app refresh the member's app shows **Mark Attendance**. A View-only user
   cannot change the switch. The grant appears in the audit trail with the officer's name.
2. A member without the permission has no Mark Attendance entry, and a direct call to any
   `/me/attendance/*` endpoint with their token returns 403.
3. Staff create a funeral event dated today from the phone; it appears in the office
   Attendance Register with the creator's name.
4. Scanning a valid card marks the member, shows their name, and the office roster shows the
   mark with the staff member's name and a Mobile badge.
5. Scanning the same card again shows "already marked" with the time and marker; the
   register still holds one row.
6. Two phones and the office USB scanner mark the same event at once with no duplicate rows
   and correct counts on all three.
7. Staff undo their own mark; they cannot remove a mark made by someone else.
8. A member with no phone is found by name and marked manually.
9. An event dated three days ago is not listed on the phone and the API refuses a mark for it.
10. The permission is removed while the scanner is open: the next scan is refused and the
    screen closes. Disabling the member's app access also removes the permission.
11. With camera permission denied, manual marking still works and the screen explains how to
    enable the camera.
12. With the connection off, a scan is shown as pending, never as marked, and is sent
    automatically when the connection returns.
13. The roster on the phone never shows a NIC or phone number.
14. All new screens are complete in Sinhala and English, in light and dark themes.
15. App version 1.4.0 continues to work unchanged against the new server.
16. Tapping the QR on the Membership Card opens a view containing only the QR code, the name
    and the society ID, on a white background in both themes; it closes on tap or back.
17. The large QR view and a printed card both scan in under a second from 30 cm, on the staff
    phone scanner and on the office USB scanner, and mark the same member.
18. The office prints one card from a member page, and a sheet for "members who have not set
    up the app"; cards show only society name, member name, society ID and QR.

---

## 13. Decisions confirmed by the owner (15 November 2026)

| # | Question | Decision |
|---|---|---|
| 1 | Can staff create events from the phone? | **Yes** (FR-3.2). |
| 2 | Which events can be marked from a phone? | **Yesterday, today and tomorrow** (D4, FR-3.5). |
| 3 | Inactive members | **Warn and still mark**, as the office app does today (FR-4.3). |
| 4 | Members without smartphones | Some will use a **printed QR card**: printing moves into version 1 (§4.7). In addition, tapping the QR in the app must open a **large QR with only the member ID and name** (FR-5.2–5.8). |
| 5 | Who may grant the permission? | **Office Staff as well as Administrators**, managed from the web and desktop UI (D9, FR-1.2). |

### Remaining small points (defaults will be used unless you say otherwise)

1. **Printed card size.** Default: ID-card size, ten per A4 sheet (FR-7.5).
2. **Which members to print first.** Default: the "members who have not set up the app" group (FR-7.3).
3. **Large QR by OTA before the new app release.** Default: yes, ship it early (phase 1b).

---

## 14. Implementation notes (16 November 2026)

Built as specified, with these deliberate differences:

| Item | As built | Why |
|---|---|---|
| Scan feedback (FR-4.3) | Colour, icon, words and **haptic** only — no sound | The app has no audio module; adding one would be another native dependency for little gain. Can be added in a later binary. |
| Large QR by OTA (phase 1b) | The large QR view ships **with 1.5.0**, not as a separate OTA to 1.4.0 | It now raises brightness, and the new native modules (camera, brightness) change the runtime fingerprint, so an OTA built from this code cannot reach 1.4.0. An OTA-only version would need building from the large-QR change alone, before the camera was added. |
| Large ID size (FR-5.4) | Society ID 28 pt, name 22 pt | The app's type scale tops out at 28. |
| Pending scans (NFR-2) | Kept in memory on the scanner screen and retried every 5 s; leaving the screen with unsent scans asks first | Full offline mode (§7.7) remains a follow-up. |
| Phone roster | Plain list | Fine for a few hundred members; virtualise if a society grows past that. |
| Microphone | `RECORD_AUDIO` blocked; camera plugin `recordAudioAndroid: false` | Only `CAMERA` is requested. |

Where things live:

- Server: migration `018_mobile_attendance`, `server/lib/attendance.js` (shared rules), `server/middleware/attendanceStaff.js`, `server/routes/meAttendance.routes.js`, new routes in `members.routes.js` (`PUT /:id/app-staff`, `GET /app-staff`, `GET /qr-cards`), `permissions` on `GET /me/profile`, error `code` echoed by the global handler.
- Tests: `server/test/attendance.test.js` (unit, in `npm test`), `server/test/attendance.db.test.js` (13 integration tests, in `npm run test:db` and CI).
- Web: `features/members/components/AttendanceStaffCard.tsx`, `PrintCardsDialog.tsx`, `features/members/cards.ts`, `lib/qr/qr.ts`, `features/attendance/components/MobileStaffPanel.tsx`, roster/CSV/event-list changes, Settings switch.
- Mobile: `app/attendance/{index,new,[id]}.tsx`, `ui/LargeQr.tsx`, `lib/attendance.ts`, hooks in `api/hooks.ts`, Home and More entries, version 1.5.0.
- Privacy policy: camera, attendance records and app activity added (`deploy/prod/privacy/index.html`).

