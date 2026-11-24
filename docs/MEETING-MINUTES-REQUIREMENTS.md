# eSamithi — Meeting Minutes (සභා වාර්තා) Requirements

**Status:** Draft for owner approval · **Date:** 24 November 2026
**Owner:** Sachira · **Applies to:** `server/` (API), `web/` (office web app and the desktop 1.4.0 shell that loads it), `mobile/` (member app 1.6.1 → 1.7.0)
**Visual mockups:** <https://claude.ai/artifact/Vrk9dPMn2b2TCcXiAWY8MP> (private until shared from its Share menu). Frames M1–M4 (members), S1–S3 (Secretary), W1–W3 (office web) each cite their section here.
**Depends on:** `MEMBER-MOBILE-APP-REQUIREMENTS.md` · `MOBILE-APP-REDESIGN-REQUIREMENTS.md` (eSamithi Calm design language, five tabs) · `ESAMITHI-WEB-APP-REQUIREMENTS.md` §4 (web brand) · `MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md` (the member-as-staff permission pattern this feature reuses)

---

## 0. Summary

Every society meeting ends with a written report, the **Sabha Warthawa (සභා වාර්තාව)**, that the
Secretary reads aloud at the *next* meeting for members to confirm. Today the report lives on
paper in one book. Members who missed the meeting never see it until it is read out, and
mistakes are found only on the day, in front of everyone.

This feature lets the Secretary publish the report from the **member app they already use**:

1. **Photograph the pages** (or pick photos), put them in order, rotate any that came out sideways.
   eSamithi turns them into **one PDF** in exactly that order.
2. **Record themselves reading it** (or attach a recording made elsewhere).
3. **Save a draft** at any point and come back later. Publish when ready.
4. **Publishing** makes the report available to every member of that society, puts a notice in
   Notices and sends a push notification that opens the report directly.

Members read the pages and **listen while they read**, open **earlier versions**, and **comment
on mistakes** in one shared thread. The Secretary replies and marks a correction as addressed
in a new version. The office web app sees everything: reports, versions, audio and comments.
It can also moderate (hide a comment, withdraw a version published by mistake) and publish on
the Secretary's behalf when the Secretary has no smartphone.

The Secretary is identified through **Settings → System Users**: a system user gets a
**Society Position** (Secretary, President, Treasurer) and a **Linked Member** (their member
app account). Whoever is the current Secretary can publish. Changing the Secretary moves that
power instantly, while old versions keep the name of the person who actually published them.

### 0.1 Owner decisions (24 Nov 2026)

| # | Decision | Choice |
|---|---|---|
| D1 | Release | **Staged.** Server, office web and the mobile reading, photo → PDF, draft, publish and comment flows ship **over the air on 1.6.1**. Audio recording, audio upload from the phone and audio playback arrive in the **1.7.0 Play build** (§11). |
| D2 | Office web role | **Read + moderate + publish.** Browse, read, listen, versions and comments (the brief), plus hide a comment, withdraw/restore a version and create/publish from the PC. |
| D3 | Deliverable | This document (MD + PDF) **and** visual mockups (link above). |

### 0.2 What this document is

The requirements for every part of the feature, each tied to the existing code it extends.
Every line of the owner's brief is traced to a section in **Appendix D**. Section numbers are
stable so tickets and the mockups can cite them (e.g. "§8.2.3").

---

## 1. Goals, users and non-goals

### 1.1 Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | A Secretary with an ordinary Android phone can publish a complete report (pages + reading) without help. | First real report published by a Secretary without office assistance. |
| G2 | Members can read and listen before the next meeting. | Report opens in < 3 s on 3G (§10). |
| G3 | Mistakes are caught before the meeting, in writing, and their fix is visible. | Corrections marked "Fixed in vN". |
| G4 | The official record is never lost or silently changed. | Every published version kept, numbered and attributed. |
| G5 | Only the right person can publish, enforced by the server. | Permission tests (§12). |

### 1.2 Users

| User | Context | Implication |
|---|---|---|
| **Secretary (ලේකම්)** | Often 45–70, Sinhala-first, a budget Android phone, writes the minutes by hand in the minute book, uses the app a few times a month. | Large steps, one thing per screen, nothing lost if the phone rings or the app closes, clear progress, plain Sinhala. |
| **Members** | The same audience as the rest of the app (rural, elderly, 3G, daylight). Many prefer listening to reading handwriting. | Audio first-class; pages readable with zoom; nothing to install. |
| **Office staff and administrators** | Use the web app or desktop 1.4.0 shell on a PC. | Browse by year and month, see comments, act on misuse, publish on behalf. |

### 1.3 Non-goals (v1)

* Uploading an existing PDF or Word file as the report (photos only). Typed minutes may come later.
* Text recognition (OCR) or automatic transcription of the audio.
* An approval step by the President or Treasurer before publishing. Those positions are **labels only** in v1 (§13).
* Other Meeting Records categories (agenda, financial statements). The data model and navigation are built for them (`category` column, category tabs) but only **Meeting Minutes** exists.
* SMS to members without the app.
* In-browser audio recording in the office web app (blocked by policy, see §6.6).

---

## 2. Roles and permissions

### 2.1 Who is who

| Role | How the system knows |
|---|---|
| **Member** | Signed in to the member app for that society (member token, `typ:'member'`). |
| **Secretary** | A member whose member id is the **Linked Member** of the society's one **active** system user with **Society Position = Secretary** (§3). Checked against the database on **every request**, never stored in the token, exactly like the attendance-staff permission (`server/middleware/attendanceStaff.js:9-36`). |
| **Administrator** | System user with Access Role `admin`. |
| **Staff** | System user with Access Role `user`. |
| **View only** | System user with Access Role `viewer` (already refused every non-GET by `server/middleware/auth.js:42-44`). |
| **Platform support** | Impersonation tokens behave as today (their writes are logged to `support_actions`). |

### 2.2 Permission matrix

| Action | Member | Secretary (app) | Admin (web) | Secretary's own system user (web) | Staff (web) | View only (web) |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Browse and read published minutes, listen, versions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comment | ✓ | ✓ (reply) | — | — | — | — |
| Reply to a comment, mark addressed | — | ✓ | ✓ | ✓ | — | — |
| See drafts | — | ✓ | ✓ | ✓ | — | — |
| Create / edit draft, pages, audio | — | ✓ | ✓ | ✓ | — | — |
| Publish (and choose notify on a revision) | — | ✓ | ✓ | ✓ | — | — |
| Hide / unhide a comment | — | ✓ | ✓ | ✓ | ✓ | — |
| Withdraw / restore a published version | — | — | ✓ | — | — | — |
| Assign Society Position and Linked Member | — | — | ✓ | — | — | — |

The defaults for "who in the office may publish" (Admin + the Secretary's own login) and
"Staff may hide comments" are **open decisions OD1, OD2** (§13).

### 2.3 Rules

* **P1 Server enforcement.** Every write is authorised on the server. The app hiding a button is never the protection. A publish request from any other member account returns `403 {code:'NOT_SECRETARY'}`.
* **P2 Fresh check.** The Secretary test is re-read from the database on every request (one indexed query). Reassigning, disabling or deleting the Secretary's system user, or deactivating the linked member or their app access, removes the power **on the next request**, even though their member token is still valid for up to 15 minutes.
* **P3 Society scope.** Each society is its own database, so all checks, data and files are automatically per society. A person who is a member of two societies is Secretary only in the society whose System Users say so. The app shows the Secretary controls only while that society is active.
* **P4 Drafts belong to the society.** A draft is not personal. When the Secretary changes, the new Secretary sees and continues every draft, and can start revisions of any published report.
* **P5 History is fixed.** Each published version stores a **snapshot** of who published it (name, position, member number or username), so reassignment or deletion never rewrites history.
* **P6 Office publishing.** When an office user publishes, the version records them as the author ("Published by the office: Nimal Perera, Administrator").

---

## 3. Identifying officials: System Users changes

Today: Settings → System Users lists users as cards with a role badge
(`web/src/features/settings/SettingsPage.tsx:303-353`). The only actions are **Add**
(`components/UserDialogs.tsx:14-87`), **Reset password** and **Delete**. The server has no
update route (`server/routes/users.routes.js`) and `GET /users` returns only
`id, username, full_name, role`.

### 3.1 New fields

| Field | Behaviour |
|---|---|
| **Access Role** | Unchanged: User, Administrator, View only. |
| **Society Position** | Secretary, President, Treasurer, Unassigned (default). Sinhala: ලේකම්, සභාපති, භාණ්ඩාගාරික, පත් කර නැත. |
| **Linked Member** | Search and pick from this society's Member Registry with the existing `MemberPicker` (`web/src/components/MemberPicker.tsx`, name / member ID / NIC search). Optional, except required for Secretary. |
| **Active** | On/off. New on the tenant side (today only the platform can disable a user). Off = cannot sign in, and loses any position power. |

### 3.2 Add and Edit dialogs

* **Add user** gains Society Position and Linked Member below Access Role.
* **Edit user** is new: a pencil button on each user card opens the same form (Full name, Access Role, Society Position, Linked Member, Active). Username is shown read-only. Password stays on its own Reset button.
* Only Administrators see System Users at all (unchanged, `SettingsPage.tsx:37`).

**Validation (client and server):**

* **V1** Society Position = Secretary requires a Linked Member. Message: "Choose the member account this Secretary uses in the eSamithi app."
* **V2** A member can be linked to at most one system user (`UNIQUE(member_id)`).
* **V3** The linked member should be active with app access (`members.is_active`, `members.app_enabled`). If not, the form shows a warning, not an error: "Kamal has not set up the member app yet. They can publish minutes once they sign in." The office can still save.
* **V4** One current Secretary per society (§3.3).
* **V5** The last active Administrator cannot be demoted or disabled (extends the existing last-admin guard, `users.routes.js:66-71`).
* **V6** A user cannot disable their own account.

### 3.3 Reassigning the Secretary

1. An admin sets Secretary on user B while user A holds it.
2. Server returns `409 {code:'SECRETARY_TAKEN', current:{user_id, full_name, member_name}}` unless the request carries `replace_secretary:true`.
3. Web shows `ConfirmDialog` (`web/src/components/ConfirmDialog.tsx`): **"Make Sunil Silva the Secretary?"** "Kamal Perera will stop being Secretary. Their drafts stay with the society and Sunil can continue them. Kamal will no longer be able to publish minutes." [Cancel] [Make Sunil Secretary].
4. On confirm, one transaction sets A to Unassigned and B to Secretary (the unique `secretary_slot`, §5.1, makes two Secretaries impossible even under a race).
5. A's power ends on their next request (P2). Push to the new Secretary's linked member: "You are now the Secretary of {society}. Meeting minutes are under Me → Meeting Records."

### 3.4 Other effects

| Event | Effect |
|---|---|
| Secretary's system user disabled (Active off) | Publishing power revoked at once. Position kept so re-enabling restores it. |
| Secretary's system user deleted | Delete is allowed. Power revoked. History keeps the snapshot. |
| Linked member deactivated or app access turned off | Power revoked (P2). Web user card shows a warning badge "Linked member inactive". |
| Linked member deleted | Blocked while linked: "This member is linked to the system user 'kamal'. Unlink them first." |

### 3.5 System Users list

Each card adds, under the name: a **position badge** (Secretary in the brand colour, others neutral) and **"Member: Kamal Perera · M-0123"** when linked. Inactive users show an "Inactive" badge and dimmed text. A one-line explainer above the list: "The Secretary can publish meeting minutes from the member app."

### 3.6 Officer trail

A new `officer_events` table (modelled on `member_staff_events`, migration 018) records every change to position, linked member and active flag: who, when, before, after, and `by_name` so the record reads correctly after a user is deleted. Visible to admins as a small "History" link in the Edit dialog.

### 3.7 Server

* `GET /users` adds `is_active`, `society_position`, `member_id`, `member_name`, `member_society_id`, `member_app_ready`.
* New `PATCH /users/:id` (admin only): `full_name`, `role`, `is_active`, `society_position`, `member_id`, `replace_secretary`. Disabling revokes that user's staff sessions through the existing `sessions.revokeUser` (as `internal.routes.js:151-176` already does).
* `GET /me/profile` adds `'minutes'` to `permissions` when the member is the current Secretary (next to `'attendance'`, `me.routes.js:35-44`), and adds `officer_position: 'secretary' | null` for display.

---

## 4. Navigation and information architecture

### 4.1 Office web

* **Sidebar:** Society group (`web/src/app/shell/nav.ts:33-39`) gains **Meeting Records** (icon `BookOpenText`), between Message Portal and Reports. The nav is one level deep. "Meeting Records → Meeting Minutes" is expressed as **category tabs inside the page**, with Meeting Minutes the only tab in v1.
* **Route:** `/meeting-records` with URL search params `category=minutes`, `year`, `month`, `report`, `v`, validated with the helpers in `web/src/lib/router/search.ts`. A link to a report and version is shareable inside the office.
* Also added to the command palette ("Go to Meeting Records") and the a11y route list (`web/e2e/a11y.spec.ts`).

### 4.2 Member app

The brief's "More" is today's **Me** tab (the redesign replaced More, `mobile/src/app/(tabs)/me.tsx`).

* **Me → Society** group (Society info, Society funds, Help) gains **Meeting Records** as its first row.
* **Me → Society officer** (new group, Secretary only): "Meeting minutes: prepare and publish" with a count of open drafts and unaddressed comments.
* **Home:** when the Secretary has a draft open, a quick action "Continue minutes" appears. When a new report is published, members see it in the Notices tab and the Home notice card.

Routes (expo-router, registered inside the signed-in `Stack.Protected` in `mobile/src/app/_layout.tsx`):

| Route | Screen |
|---|---|
| `meeting-records/index` | Meeting Records: category tabs + Meeting Minutes list |
| `meeting-records/[id]` | Report reader (latest published, or `?v=` for a version) |
| `meeting-records/[id]/versions` | Version history |
| `meeting-records/[id]/comments` | Full comment thread (also embedded in the reader) |
| `meeting-records/secretary` | Secretary hub: drafts, published reports to update, comments to answer |
| `meeting-records/draft/[id]` | Draft editor (details → pages → audio → preview & publish) |
| `meeting-records/draft/[id]/camera` | Page capture loop |

### 4.3 Browsing rules

* Latest **published** first, ordered by `meeting_date DESC, published_at DESC`.
* Grouped by **year**, then **month**, both from the **meeting date** (not the publish date).
* Several meetings in one month each have their **own report** (e.g. the general meeting and a special meeting).
* Each row: meeting date (DateBlock), report title, latest version ("v2"), publication date, and a headphones icon if it has audio.
* Year chips across the top (only years that have reports). Older years load as you scroll.
* A withdrawn version never appears to members. A report whose only version is withdrawn disappears from members' lists.

### 4.4 Sinhala vocabulary

| English | Sinhala | Status |
|---|---|---|
| Meeting Minutes | සභා වාර්තා | From the brief |
| Meeting minutes (one report) | සභා වාර්තාව | From the brief |
| Meeting Records | රැස්වීම් වාර්තා | **OD6**: confirm with a native reader |
| Secretary / President / Treasurer | ලේකම් / සභාපති / භාණ්ඩාගාරික | Confirm |
| Version | සංස්කරණය | Confirm |
| Draft | කෙටුම්පත | Confirm |
| Publish | ප්‍රකාශයට පත් කරන්න | Confirm |
| Addressed / fixed in v3 | v3 හි නිවැරදි කළා | Confirm |

---

## 5. Data model

Tenant database, appended as migrations **020 onwards** to `server/migrations/index.js`. Every
`up()` is idempotent (`INFORMATION_SCHEMA` checks / `CREATE TABLE IF NOT EXISTS`), per the
rules at the top of that file. Never edit an applied migration.

### 5.1 `users` (020_officers)

```sql
ALTER TABLE users
  ADD COLUMN society_position ENUM('secretary','president','treasurer') NULL,
  ADD COLUMN member_id INT NULL,
  ADD COLUMN secretary_slot TINYINT AS (IF(society_position='secretary', 1, NULL)) STORED,
  ADD UNIQUE KEY uq_users_member (member_id),
  ADD UNIQUE KEY uq_users_secretary (secretary_slot),
  ADD CONSTRAINT fk_users_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT;

CREATE TABLE officer_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL, field VARCHAR(32) NOT NULL,
  before_value VARCHAR(255) NULL, after_value VARCHAR(255) NULL,
  by_user_id INT NULL, by_name VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX (user_id));
```

`secretary_slot` is 1 for the Secretary and NULL for everyone else; a UNIQUE key allows many
NULLs but only one 1, so **one Secretary per society** is enforced by the database.
`ON DELETE RESTRICT` implements "cannot delete a linked member" (§3.4).

### 5.2 Meeting records (021_meeting_records)

```sql
CREATE TABLE meeting_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('minutes') NOT NULL DEFAULT 'minutes',
  current_version_id INT NULL,              -- latest PUBLISHED version
  created_by_member_id INT NULL, created_by_user_id INT NULL,
  client_ref CHAR(36) NULL UNIQUE,          -- idempotent create
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL);                -- only for never-published drafts

CREATE TABLE meeting_report_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  version_no INT NULL,                      -- NULL while draft, 1,2,3… on publish
  state ENUM('draft','published','withdrawn') NOT NULL DEFAULT 'draft',
  draft_slot TINYINT AS (IF(state='draft', 1, NULL)) STORED,
  title VARCHAR(200) NOT NULL,
  meeting_date DATE NOT NULL,
  change_summary VARCHAR(500) NULL,
  page_count INT NOT NULL DEFAULT 0,
  pdf_file VARCHAR(128) NULL, pdf_hash CHAR(64) NULL, pdf_bytes INT NULL,
  audio_file VARCHAR(128) NULL, audio_ms INT NULL, audio_bytes INT NULL, audio_mime VARCHAR(40) NULL,
  author_member_id INT NULL, author_user_id INT NULL,
  author_name VARCHAR(255) NULL, author_position VARCHAR(32) NULL, author_ref VARCHAR(64) NULL,
  published_at DATETIME NULL,
  publish_ref CHAR(36) NULL UNIQUE,         -- idempotent publish
  notify TINYINT NOT NULL DEFAULT 1, notified_at DATETIME NULL,
  withdrawn_at DATETIME NULL, withdrawn_by_user_id INT NULL, withdrawn_reason VARCHAR(300) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_version_no (report_id, version_no),
  UNIQUE KEY uq_one_draft (report_id, draft_slot),
  INDEX (state, meeting_date),
  FOREIGN KEY (report_id) REFERENCES meeting_reports(id));

CREATE TABLE meeting_report_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  position INT NOT NULL,                    -- 1-based page order
  file VARCHAR(128) NOT NULL, thumb VARCHAR(128) NOT NULL,
  rotation SMALLINT NOT NULL DEFAULT 0,     -- 0/90/180/270, applied at render time
  width INT NOT NULL, height INT NOT NULL, bytes INT NOT NULL,
  client_ref CHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_page_ref (version_id, client_ref),
  INDEX (version_id, position),
  FOREIGN KEY (version_id) REFERENCES meeting_report_versions(id));

CREATE TABLE meeting_audio_uploads (
  id CHAR(36) PRIMARY KEY,                  -- upload id from the client
  version_id INT NOT NULL,
  mime VARCHAR(40) NOT NULL, total_bytes INT NOT NULL, received_bytes INT NOT NULL DEFAULT 0,
  duration_ms INT NULL, tmp_file VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL, completed_at DATETIME NULL);

CREATE TABLE meeting_report_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  version_id INT NOT NULL,                  -- version the author was viewing
  parent_id INT NULL,                       -- reply to
  author_member_id INT NULL, author_user_id INT NULL,
  author_name VARCHAR(255) NOT NULL, author_is_secretary TINYINT NOT NULL DEFAULT 0,
  body VARCHAR(1000) NOT NULL,
  status ENUM('open','addressed') NOT NULL DEFAULT 'open',
  addressed_in_version_id INT NULL, addressed_at DATETIME NULL, addressed_by_name VARCHAR(255) NULL,
  hidden_at DATETIME NULL, hidden_by_name VARCHAR(255) NULL, hidden_reason VARCHAR(300) NULL,
  deleted_at DATETIME NULL,
  client_ref CHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comment_ref (report_id, client_ref),
  INDEX (report_id, created_at));
```

### 5.3 Notices (022_announcement_minutes)

```sql
ALTER TABLE announcements
  ADD COLUMN meeting_report_id INT NULL,
  ADD COLUMN meeting_version_id INT NULL,
  ADD UNIQUE KEY uq_ann_minutes_version (meeting_version_id);
```

`announcements.type` gains `'minutes'` (validated in `server/routes/announcements.routes.js:13`).
Retention follows the **general** rule (created + 21 days, `server/lib/announcements.js:12-26`).
The report itself never expires (G4). The unique key on `meeting_version_id` makes a duplicate
notice for one publication impossible.

### 5.4 Invariants

1. At most one **draft** per report (`uq_one_draft`). Editing a published report creates that draft.
2. `version_no` is assigned only at publish, as `MAX(version_no)+1` under a row lock, so numbers are sequential with no gaps from abandoned drafts.
3. A published version's pages, PDF and audio are **immutable**. Files are written once and never overwritten. A revision draft's page rows point at the same files until changed.
4. `meeting_reports.current_version_id` always points at the newest *published* (not withdrawn) version, or NULL.
5. Comments belong to the **report**, not a version, so one thread spans every version.

---

## 6. Files, storage and security

### 6.1 Private storage

Uploaded files today live in `uploads/` and the whole folder is served **without
authentication** at `/api/v1/uploads` (`server/server.js:59-63`). Minutes are internal society
records and **must not** go there.

* New folder **`/app/private/<tenant>/minutes/<report_id>/<version_id>/`**, on a new prod volume `/opt/esamithi-server/private:/app/private` (`deploy/prod/docker-compose.yml`, testbed equivalent). It is never mounted under a static route.
* Filenames are random (`crypto.randomBytes(16).toString('hex')`) plus extension.
* **Backups:** `deploy/prod/backup.sh` adds `private` to the nightly archive (today it tars only `uploads`, line 28), with the same 7-day local / 21-day off-site retention. Deploy scripts must exclude `private/` just as they exclude `uploads/` (`deploy-api.sh:47,79`, `.dockerignore`).

### 6.2 Signed file URLs

* The API returns **signed, path-relative URLs**: `/api/v1/files/<token>`. Token = base64url of `{t:tenant, f:relative path, e:expiry, k:kind}` + HMAC-SHA256 with a new `FILES_SECRET`. Expiry: **30 minutes** (long enough to listen to a 90-minute reading while it streams, since the player opens the stream once).
* `GET /api/v1/files/:token` verifies the signature and expiry, then `res.sendFile` with **HTTP Range** support (seeking in audio), the correct `Content-Type`, `Cache-Control: private, max-age=1800`, `Content-Disposition: inline; filename="<society> minutes <date> v<n>.pdf"` for PDFs.
* URLs are issued only to people allowed to see that file: published files to members and staff; **draft** files only to the Secretary and office publishers.
* The web app reaches the API on its own origin (`/api/` is proxied by nginx, `deploy/prod/nginx/esamithi.conf:23`), so `<img>` and `<audio>` from `/api/v1/files/…` already satisfy the CSP (`img-src 'self'`, `default-src 'self'`). **No CSP change is needed**; verify on the testbed. PDFs open in a new tab (top-level navigation), never in an iframe, so `X-Frame-Options: DENY` is not an issue.

### 6.3 Pages

| Step | Where | What |
|---|---|---|
| Capture | Phone | `expo-image-picker` `launchCameraAsync` (camera) or `launchImageLibraryAsync` (gallery), quality 1. |
| Prepare | Phone | `expo-image-manipulator`: longest side **2000 px**, JPEG **0.8**. Handwriting stays readable when zoomed; a page is typically 350–700 KB. (Puruka's 1280 px / 0.7 is too low for handwriting.) |
| Upload | Phone → API | One page per request, `multipart/form-data`, with the page's `client_ref`. Progress shown per page. |
| Normalise | API (`sharp`) | Apply EXIF orientation, strip metadata (location!), re-encode mozjpeg q80, cap the longest side at 2400 px, make a **320 px thumbnail**. Reject anything that is not a decodable image (`UNSUPPORTED_TYPE`). |
| Rotate | API | Stored as `rotation` and applied when rendering the PDF and the page image. The original file is not re-encoded on every rotate. |

Limits: **10 MB** per uploaded page, **40 pages** per version (`TOO_MANY_PAGES`). Formats: JPEG, PNG, WebP, HEIC (sharp can decode HEIC where libheif is present; if not, the phone converts first because the manipulator always outputs JPEG).

### 6.4 PDF

* Built on the server with **`pdf-lib`** (pure JavaScript, works on the `node:20-alpine` image) from the processed page JPEGs in `position` order, with rotation applied.
* Each page is fitted to **A4**, portrait or landscape to match the photo, with a small margin. No re-compression beyond §6.3.
* PDF metadata: Title = report title, Author = society name, Subject = "Meeting minutes v{n}", CreationDate = publish time. No extra cover page (the photographed pages are the record).
* `pdf_hash` = SHA-256 of the ordered list of `(file, rotation)`. The draft PDF is rebuilt only when the hash changes: on **Preview PDF**, and at publish if stale. A build failure returns `PDF_FAILED` with a retry; the draft is untouched.
* Typical size: 12 pages × ~500 KB ≈ 6 MB.

### 6.5 Audio

* **Recorded in the app (1.7.0):** `expo-audio`, AAC in `.m4a`, **mono, 44.1 kHz, 64 kbps** (≈ 29 MB per hour). Clear speech, small on 3G.
* **Uploaded file:** `.m4a`, `.mp3`, `.aac`, `.wav`, `.ogg` up to **90 minutes / 80 MB**. No transcoding (no ffmpeg on the server). Every format listed plays on Android and in Chrome/Edge (the browsers the office uses).
* **Chunked, resumable upload** (needed because nginx allows 50 MB per request, `esamithi.conf:16`, and 3G drops):
  1. `POST …/audio/uploads {upload_id (uuid), mime, total_bytes, duration_ms}` → `{received_bytes}` (0, or more when resuming).
  2. `PUT …/audio/uploads/:upload_id` with `Content-Range: bytes a-b/total`, **5 MB** chunks, appended to a temp file. Returns `{received_bytes}`.
  3. `POST …/audio/uploads/:upload_id/complete` checks size, sniffs the type, moves the file into place and sets `audio_*` on the draft.
  4. An unfinished upload expires after 48 hours and its temp file is swept.
* Duration comes from the recorder (or the client's player for picked files) and is re-checked on the server where the container allows; the server's value wins if they differ by more than 2 s.

### 6.6 Office web audio

The web app cannot record (its own `Permissions-Policy` sets `microphone=()`, `deploy/prod/nginx/app-headers.inc:10`, and the desktop shell denies all permission requests, `src/main/shell.ts:119`). The office **uploads an audio file** only, through the same chunked upload.

### 6.7 Clean-up and retention

* Published versions, their pages, PDF and audio: **kept forever** (official records). A withdrawn version keeps its files for audit.
* Files of a **discarded draft**, **replaced/deleted pages** (not referenced by any published version) and **expired audio uploads** are removed by a sweep added to the existing 12-hour job loop (`server/server.js:151-177`).
* Storage estimate: ~6 MB pages + ~15 MB audio ≈ **20 MB per meeting**; at 12–24 meetings a year, **0.25–0.5 GB per society per year**. With full nightly archives this is the main growth risk (§14 R1).

### 6.8 Privacy

* Page EXIF (including GPS) is stripped on the server (§6.3).
* Minutes are visible only to signed-in members and staff of that society. No public links; signed URLs expire after 30 minutes.
* The privacy page (`deploy/prod/privacy/`) gains a section on meeting minutes, photos and voice recordings: what is stored, who sees it, how long it is kept.
* Google Play **Data safety** must be updated with the 1.7.0 release: *Audio → Voice or sound recordings* (collected, not shared, app functionality) and *Photos* (already declared for Puruka; purpose extended).

---

## 7. Server API

All under `/api/v1`, tenant from `X-Samithi` (`server/middleware/tenant.js`). JSON unless noted.
Errors use `{error, code}` with stable codes (§7.6).

### 7.1 Member reading (`/me/meeting-records`, member auth)

| Method | Path | Returns |
|---|---|---|
| GET | `/me/meeting-records?category=minutes&year=&month=&cursor=` | `{years:[2026,2025], items:[{id, title, meeting_date, version_no, published_at, page_count, has_audio, comment_count}], next_cursor}`. Published only. |
| GET | `/me/meeting-records/:id` | Latest published version: `{report, version:{version_no, title, meeting_date, published_at, author_name, author_position, change_summary, page_count, pages:[{n, url, thumb_url, width, height}], pdf_url, pdf_bytes, audio_url, audio_ms}, versions:[{version_no, published_at, author_name, change_summary}]}` |
| GET | `/me/meeting-records/:id/versions/:no` | Same shape for an older version. `410 VERSION_WITHDRAWN` if withdrawn. |
| GET | `/me/meeting-records/:id/comments?cursor=` | `{items:[{id, parent_id, author_name, is_secretary, is_mine, body, version_no, status, addressed_in_version_no, created_at, hidden}], next_cursor}`. Hidden comments return `hidden:true` with no body. |
| POST | `/me/meeting-records/:id/comments` | `{client_ref, body, version_no, parent_id?}`. Members may not set `parent_id` on someone else's thread unless Secretary (members can reply to their own thread). |
| DELETE | `/me/meeting-records/comments/:cid` | Author only, within 15 minutes (**OD3**). Soft delete ("Comment removed by its author"). |
| POST | `/me/meeting-records/comments/:cid/report` | Reports an abusive comment. Creates a `concern` member request (category `content`) referencing it (reuses the Play child-safety flow, `me.routes.js:341-419`). |

### 7.2 Secretary (`/me/meeting-records/…`, member auth + Secretary check)

| Method | Path | Purpose |
|---|---|---|
| GET | `/me/meeting-records/secretary` | Hub: drafts, recent published reports, open comment counts. |
| POST | `/me/meeting-records` | Create report + first draft `{client_ref, title, meeting_date}`. Idempotent on `client_ref`. |
| POST | `/me/meeting-records/:id/revision` | Start a revision draft from the latest published version (copies page rows and audio reference). Returns the existing draft if one is open. |
| GET | `/me/meeting-records/:id/draft` | Full draft with signed draft-file URLs. |
| PATCH | `/me/meeting-records/:id/draft` | `{title?, meeting_date?, change_summary?}` (autosave). |
| POST | `/me/meeting-records/:id/draft/pages` | multipart `photo` + `client_ref` + optional `replace_page_id`. Idempotent on `client_ref`. Appends at the end unless replacing. |
| PUT | `/me/meeting-records/:id/draft/pages/order` | `{page_ids:[…]}`: the **complete** ordered list. Rejected if it is not exactly the draft's pages. |
| PATCH | `/me/meeting-records/:id/draft/pages/:pid` | `{rotation}` |
| DELETE | `/me/meeting-records/:id/draft/pages/:pid` | Remove a page. Positions are recompacted. |
| POST/PUT/POST | `…/draft/audio/uploads`, `…/:upload_id`, `…/:upload_id/complete` | Chunked audio (§6.5). |
| DELETE | `/me/meeting-records/:id/draft/audio` | Remove the draft's audio. |
| POST | `/me/meeting-records/:id/draft/pdf` | Build/refresh the preview PDF → `{pdf_url, pdf_bytes, page_count}`. |
| POST | `/me/meeting-records/:id/draft/publish` | `{publish_ref, notify}` (§7.4). |
| DELETE | `/me/meeting-records/:id/draft` | Discard the draft. A never-published report is soft-deleted. |
| POST | `/me/meeting-records/comments/:cid/reply` | Secretary reply (shown with a Secretary badge). |
| POST | `/me/meeting-records/comments/:cid/addressed` | `{version_no}` (must be a published version ≥ the comment's) or `{status:'open'}` to reopen. |
| POST | `/me/meeting-records/comments/:cid/hide` | `{reason}`, or `/unhide`. |

### 7.3 Office (`/meeting-records`, staff auth)

Same reading endpoints (without `/me`), plus the draft and publish endpoints for office
publishers (§2.2), plus:

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/meeting-records?category=&year=&month=&status=` | All staff | Includes drafts for publishers, withdrawn versions for admins. |
| POST | `/meeting-records/comments/:cid/hide` · `/unhide` | Admin, Staff (OD2) | Moderate. |
| POST | `/meeting-records/:id/versions/:no/withdraw` | Admin | `{reason}`. The version vanishes for members; `current_version_id` falls back to the previous published version. The notice for that version is deactivated. |
| POST | `/meeting-records/:id/versions/:no/restore` | Admin | Undo a withdrawal. |

### 7.4 Publishing

Publishing is the most important operation to get right. It must be safe to tap twice, to retry after a timeout and to run while an upload is still finishing.

1. Client generates `publish_ref` (uuid) **once** when the Publish screen opens and reuses it for every retry.
2. If a version with this `publish_ref` exists, return its result unchanged (`200 {already:true, …}`).
3. Check the Secretary/publisher permission (P1, P2).
4. Check readiness, else `409`:
   * at least one page (`DRAFT_INCOMPLETE`)
   * no audio upload in progress (`AUDIO_UPLOADING`)
   * title and meeting date set
5. Build the PDF if `pdf_hash` is stale (`PDF_FAILED` on error; nothing published).
6. **One transaction:** `SELECT … FOR UPDATE` the draft; `version_no = MAX+1`; `state='published'`, `published_at=NOW()`, author snapshot, `publish_ref`; `meeting_reports.current_version_id`; if notify: `INSERT` the `minutes` announcement (unique on `meeting_version_id`) and set `notified_at`.
7. **After commit:** send the push (fire-and-forget, as `announcements.routes.js:72` does). Push failures never undo a publication.
8. Notify rules: the **first** publication always notifies. A **revision** shows a "Notify members" switch, default **off**; when on, the notice reads "Meeting minutes updated: {title} (v{n})".

### 7.5 Push payloads

| Event | To | Data |
|---|---|---|
| Report published / updated (notify on) | All members with push tokens (`lib/push.js` `sendPushToAllMembers`) | `{type:'minutes', report_id, v, sam:<tenant slug>}` |
| New comment on a report | The current Secretary's linked member, at most once per 30 minutes per report | `{type:'minutes_comment', report_id, sam}` |
| A correction marked addressed | The comment's author | `{type:'minutes_comment', report_id, comment_id, sam}` |
| Made Secretary | The new Secretary's linked member | `{type:'minutes_secretary', sam}` |

`sam` is new: today pushes carry no society, so a tap opens under whichever society is active.
Minutes pushes include it, and the app switches society first (§8.4).

### 7.6 Limits and error codes

* Rate limits (per member, `express-rate-limit` keyed `tenant|m<id>` like `meAttendance.routes.js:20-33`): comments 10 per hour; page uploads 300 per day; publish 20 per day.
* Codes: `NOT_SECRETARY`, `NOT_PUBLISHER`, `SECRETARY_TAKEN`, `DRAFT_INCOMPLETE`, `AUDIO_UPLOADING`, `PDF_FAILED`, `TOO_MANY_PAGES`, `FILE_TOO_LARGE`, `UNSUPPORTED_TYPE`, `AUDIO_TOO_LONG`, `VERSION_WITHDRAWN`, `COMMENT_TOO_LONG`, `ORDER_MISMATCH`.
* Each maps to a plain-language message with a next step in both languages (§8, Appendix C).

---

## 8. Screen specifications

Every screen below follows the eSamithi Calm rules (`MOBILE-APP-REDESIGN-REQUIREMENTS.md`):
tokens only, `useType()` families with line heights, the settle spring, targets ≥ 48 dp,
Sinhala tested first, and the design gates (`mobile/scripts/check-*.mjs`). Mockup numbers
refer to the mockup page.

Each screen lists: **purpose**, **layout**, **states**, **interactions**, **acceptance**.

### 8.1 Member app: members

#### 8.1.1 Meeting Records list (`meeting-records/index`)

**Purpose:** find this month's or an older report quickly.

```
┌───────────────────────────────┐
│ ← Meeting Records             │
│ [ Meeting Minutes ]           │  category tabs (one in v1)
│ (2026) (2025) (2024)          │  year chips
│ NOVEMBER                      │
│ ┌──┐ Monthly general meeting  │
│ │16│ v2 · published 18 Nov  🎧│
│ │NOV                          │
│ ┌──┐ Special meeting: funeral │
│ │ 3│ v1 · published 5 Nov   🎧│
│ OCTOBER                       │
│ ┌──┐ Monthly general meeting  │
│ │19│ v1 · published 21 Oct    │
└───────────────────────────────┘
```

* **States:**
  * Loading: skeleton rows.
  * Empty: "No meeting minutes yet. When the Secretary publishes the report of a meeting, it appears here." (EmptyIllustration).
  * Error with no cache: ErrorView + Retry.
  * Stale cache: StaleBanner.
* **Interactions:** tap a row → reader. Year chip filters. Pull to refresh. The Secretary sees a Fab "Prepare minutes" → Secretary hub.
* **Acceptance:**
  * A1 Rows ordered by meeting date, newest first.
  * A2 Two meetings in one month appear as two rows under one month header.
  * A3 Years with no reports have no chip.
  * A4 Withdrawn-only reports never appear.

#### 8.1.2 Report reader (`meeting-records/[id]`)

**Purpose:** read the pages and listen at the same time.

```
┌───────────────────────────────┐
│ ← Monthly general meeting     │
│ Meeting 16 Nov 2026           │
│ v2 · Published 18 Nov 2026    │
│ by Kamal Perera, Secretary    │
│ ┌───────────────────────────┐ │
│ │                           │ │
│ │   (page image, pinch to   │ │  pager: swipe ← →
│ │    zoom, double-tap)      │ │
│ │                           │ │
│ └───────────────────────────┘ │
│   ‹  Page 3 of 12  ›   [▦]    │  ▦ = page thumbnails sheet
│ ┌───────────────────────────┐ │
│ │ ▶  Reading   12:04 / 31:40│ │  sticky audio bar
│ │ ━━━━━━━●───────── 1x  ↺15 ↻15│
│ └───────────────────────────┘ │
│ [ Save or share PDF ]         │
│ Versions (2) ›                │
│ Comments (5) ›  2 open        │
└───────────────────────────────┘
```

* **Header:** meeting date (large), publication date, version, author name and position. Change summary for v ≥ 2 ("What changed in v2: corrected the treasurer's figure on page 3").
* **Pages:**
  * Thumbnails load first, then the full image.
  * Pinch zoom and double-tap, reusing `mobile/src/ui/PhotoViewer.tsx` gestures. Swipe to change page; "Page 3 of 12" with ‹ › buttons for people who don't swipe.
  * The page grid sheet jumps to any page.
* **PDF:** "Save or share PDF" downloads to the cache (`expo-file-system`) with a progress ring, then opens the share sheet (`expo-sharing`) so the member can open it in a PDF app, save it or send it on WhatsApp.
* **Audio (1.7.0 binary):**
  * Sticky bar at the bottom of the reader, built on `expo-audio`.
  * Controls: play/pause; a scrubber you can drag; elapsed and total time; back and forward 15 s; speed 0.75× / 1× / 1.25× / 1.5×.
  * Audio keeps playing while pages are swiped or zoomed, and while the comments sheet is open.
  * It pauses when leaving the report and resumes from the same position when returning within the session.
  * It stops on a phone call (audio focus).
* **Audio on a 1.6.1 binary:** the bar is replaced by a Callout: "Listening needs the latest app. Update eSamithi from Play Store." with an "Update" button that opens the Play listing. Detection is `requireOptionalNativeModule('ExpoAudio')`, so the same JS bundle runs on both binaries.
* **States:**
  * Page fails to load: that page shows "Couldn't load page 3" + Retry; other pages still work.
  * Audio fails: "Couldn't load the recording" + Retry.
  * Viewing an older version: Callout "You are reading v1. A newer version (v2) is available." + "Open latest".
* **Acceptance:**
  * A1 Opening a report shows the latest published version.
  * A2 Pages appear in exactly the published order.
  * A3 Swiping pages never stops or restarts audio.
  * A4 Seeking works on a 30-minute recording over 3G (Range requests).
  * A5 A failed page or audio load can be retried without leaving the screen.

#### 8.1.3 Version history (`meeting-records/[id]/versions`)

List of published versions, newest first: "v2 · 18 Nov 2026 · Kamal Perera (Secretary)" and
the change summary. The current one is marked "Latest". Tap opens that version in the reader.
Withdrawn versions are not shown to members.

**Acceptance:** A1 Every published version is listed with its date, author and summary.
A2 Publishing v3 does not change v1 or v2 in any way.

#### 8.1.4 Comments (`meeting-records/[id]/comments`, and a preview in the reader)

```
┌───────────────────────────────┐
│ Comments  [All][Open][Fixed]  │
│ ┌───────────────────────────┐ │
│ │ Sunil Silva · 19 Nov · v1 │ │
│ │ On [page 3] the treasurer's│ │
│ │ figure should be 12,500.  │ │
│ │ ✓ Fixed in v2             │ │
│ │  ↳ Kamal Perera SECRETARY │ │
│ │    Thank you, corrected.  │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Nimali · 20 Nov · v2      │ │
│ │ At [12:34] the date of the│ │
│ │ next meeting is wrong.    │ │
│ │ Open                      │ │
│ └───────────────────────────┘ │
│ [ Write a correction…    ][➤] │
└───────────────────────────────┘
```

* **One thread across all versions.** Each comment shows the commenter's name, time and the version they were viewing ("on v1").
* **Page and time references:** members just type them. "page 3", "p. 3", "පිටුව 3", "12:34", "1:02:10" become tappable chips. A page chip jumps the reader to that page; a time chip seeks the audio (1.7.0). Parsing is client-side; the stored body stays plain text.
* **Status:** Open, or "Fixed in v2" (green, with the Secretary's name).
* **Secretary replies** carry a "Secretary" badge.
* **Hidden comments** show "This comment was hidden by the society."
* **Members can:**
  * delete their own comment within 15 minutes (OD3);
  * report someone else's comment ("Report" in a long-press menu), which goes to the office as a concern. This satisfies Google Play's user-generated content policy, as Puruka reports already do.
* **Composer:**
  * 1000 characters with a counter at 900.
  * Hint: "Mention a page (page 3) or a time in the recording (12:34)."
  * Send is disabled while empty.
  * Sending is idempotent (`client_ref`). A failed send keeps the text with Retry.
* **Acceptance:**
  * A1 Every member of the society sees every visible comment.
  * A2 Each comment shows the version it was written on.
  * A3 After v2 is published, v1's comments are still there, with their v1 tag.
  * A4 A double-tapped Send creates one comment.

### 8.2 Member app: the Secretary

#### 8.2.1 Secretary hub (`meeting-records/secretary`)

Three sections:
* **Drafts:** title, meeting date, "8 pages · recording 24:10", last saved; tap to continue.
* **Published:** each with "Update" (starts a revision).
* **Comments to answer:** open count per report.

The primary button is **"New meeting minutes"**. If the person is no longer Secretary (403
`NOT_SECRETARY`), the screen refreshes the profile and shows "You are no longer the Secretary.
Drafts stay with the society for the new Secretary." then returns to Me.

#### 8.2.2 Draft editor: step 1, details

* **Fields:** report title (suggestions: "Monthly general meeting", "Annual general meeting", "Special meeting"), and meeting date (`DateField` from `mobile/src/ui/auth.tsx`, not in the future).
* **Autosave:** a draft is created on first Next (idempotent `client_ref`) and autosaved after that.
* **Stepper** across the top: Details · Pages · Recording · Publish. Steps can be revisited in any order; Publish shows what is missing.

#### 8.2.3 Step 2, pages

```
┌───────────────────────────────┐
│ Pages (8)                     │
│ ┌────┐┌────┐┌────┐            │
│ │ 1  ││ 2  ││ 3 ⟳│  numbered  │
│ └────┘└────┘└────┘  thumbs    │
│ ┌────┐┌────┐┌────┐            │
│ │ 4  ││ 5 ▲││ 6  │ ▲ uploading│
│ └────┘└────┘└────┘            │
│ ┌────┐┌────┐┌ ─ ─┐            │
│ │ 7 !││ 8  │  +   │ ! = failed │
│ └────┘└────┘└ ─ ─┘ tap: retry │
│ [📷 Take photo] [🖼 From gallery]│
│ [ Preview PDF ]               │
└───────────────────────────────┘
```

* **Add pages one at a time:**
  * "Take photo" opens the camera.
  * After each shot a review screen shows Retake · Use. "Use" adds the page and goes straight back to the camera for the next page.
  * "Done" ends the loop.
  * "From gallery" allows picking several, added in the order picked.
* **Numbered thumbnails** in a 3-column grid. Each tile shows its number and its upload state: uploading (progress ring), done, or failed (red ! with Retry on tap).
* **Reorder:**
  * Long-press and drag (gesture-handler + reanimated, the settle spring).
  * Also a page sheet with "Move earlier / Move later / Move to position…", for accessibility and people who find dragging hard.
  * Order changes are sent as the complete list (`PUT …/pages/order`) after the drag settles.
* **Tap a tile** opens the page sheet with:
  * full preview with zoom;
  * Rotate ⟳ 90°;
  * Replace (camera or gallery);
  * Remove, with a toast "Page 5 removed" and Undo for 5 s.
* **Preview PDF** builds the draft PDF (§6.4) with a progress state ("Making the PDF…") and opens it through the share sheet / PDF app. It is enabled when there is at least one page and no page is uploading.
* **Limits:** the 40th page shows "This is the most pages one report can have".
* **Never lose a page:** each prepared page is written to the app's document directory (`expo-file-system`) **before** upload, in a per-society, per-draft folder, with a small queue file (`pending.json`). A failed or interrupted upload retries automatically:
  * when the screen opens;
  * when the app returns to the foreground;
  * on the Retry tap.

  Uploaded pages are never re-sent (idempotent `client_ref`). The local copy is deleted once the server confirms.
* **Acceptance:**
  * A1 The PDF's page order equals the grid order after any sequence of drags and moves.
  * A2 Rotating page 3 shows rotated in the thumbnail, the preview and the PDF.
  * A3 Killing the app during an upload and reopening resumes it, and keeps pages already uploaded.
  * A4 A failed page never blocks other pages from uploading.

#### 8.2.4 Step 3, recording (1.7.0)

```
┌───────────────────────────────┐
│ Recording                     │
│ Read the minutes aloud, as    │
│ you would at the meeting.     │
│                               │
│           24:10               │  large timer
│     ▁▃▅▇▅▃▁▂▄▆▄▂▁            │  live level
│                               │
│   [ ⏸ Pause ]  [ ■ Stop ]     │
│                               │
│ or  [ Choose an audio file ]  │
└───────────────────────────────┘
```

* **States:**

  | State | What the screen shows |
  |---|---|
  | Idle | "Start recording" button and "Choose an audio file" |
  | Recording | Timer, level meter, Pause, Stop |
  | Paused | Timer frozen; Resume and Stop |
  | Stopped (review) | Player (play/pause, scrubber, elapsed/total); "Use this recording", "Delete and record again" (confirm), "Replace with a file" |
  | Uploading | Progress bar with MB sent / total and resume-on-reconnect |
  | Uploaded | Player, duration, "Replace" and "Remove" |

* **Recording behaviour:**
  * The screen stays awake while recording (`expo-keep-awake`, already in the binary).
  * A phone call or another app taking the microphone **pauses** the recording, with a banner "Paused because of a call. Tap Resume to continue."
  * Max **90 minutes**; a warning appears at 85 minutes.
  * The recording is written to the app's documents folder (not the cache), so a crash or app kill leaves a file that is offered back on reopen: "You have an unsaved recording of 24:10. Keep it?"
* **Choose an audio file** uses `expo-document-picker` (`audio/*`) and checks type, size and duration before upload.
* **Permission:**
  * Asked when Start is first tapped, with an explanation first: "eSamithi needs the microphone to record you reading the minutes. The recording is shared only with your society's members."
  * If denied: Callout with steps and an "Open settings" button (`Linking.openSettings()`).
  * The camera gets the same treatment in step 2.
* **On a 1.6.1 binary:** the step shows "Recording needs the latest app. Update eSamithi from Play Store." The Secretary can still publish without audio and add it later as a revision, or the office can attach a file (§8.3.4).
* **Acceptance:**
  * A1 Pause/resume produces one continuous file.
  * A2 The recording can be played back, deleted and re-recorded before publishing.
  * A3 An uploaded file can be replaced.
  * A4 A failed audio upload never removes uploaded pages, and resumes from where it stopped.

#### 8.2.5 Step 4, preview and publish

* **Final preview** shows everything in one place:
  * the meeting details;
  * the first page and page count, with "Preview PDF";
  * the audio player and duration;
  * for a revision, a required **"What changed?"** field (max 500 characters, e.g. "Corrected the treasurer's figure on page 3") and a **"Notify members"** switch (default off).
* **Checklist:** ✓ Title and date · ✓ 12 pages uploaded · ✓ Recording uploaded (or "No recording: members will only see the pages", which is allowed).
* **Publish:**
  * The **Publish** button is disabled until every item is ready. A confirm sheet says "Publish to all 214 members of {society}? They will get a notification." (or "…They will not be notified" for a revision with the switch off).
  * The `publish_ref` is created when this screen opens and reused for retries (§7.4).
  * Progress shows: "Making the PDF…" → "Publishing…" → success.
  * On a network error: "We couldn't confirm the report was published. Tap Try again. It will not be published twice."
* **Success:** a large tick, "Meeting minutes published", "Open report", "Back to Meeting Records".
* **Acceptance:**
  * A1 Publish is impossible while anything is uploading.
  * A2 Repeating Publish (double tap, retry after timeout) creates exactly one version and one notice.
  * A3 After publishing a revision, v1 still opens from Version History.

### 8.3 Office web app

#### 8.3.1 Settings → System Users

Specified in §3. Mockup W1 (list) and W2 (Edit dialog + reassignment confirmation).

#### 8.3.2 Meeting Records browse (`/meeting-records`)

* **Header and filters:**
  * PageHeader "Meeting Records" with Category tabs (Meeting Minutes).
  * Filters: Year and Month `NativeSelect`s (pattern from `web/src/features/reports/ReportsPage.tsx:258-276`), plus Status (Published / Drafts / Withdrawn, the last two for publishers and admins).
* **Table** (`DataTable`):

  | Column | Shows |
  |---|---|
  | Meeting date | |
  | Title | |
  | Latest version | |
  | Published | |
  | Author | |
  | Pages | |
  | Audio | duration |
  | Comments | open / total |

* **Rows:** clicking a row opens the detail. "New meeting minutes" (publishers only) opens the draft editor.
* **Feature folder:** `web/src/features/meeting-records/` (`api.ts`, `types.ts`, `queries.ts`, `components/`), following the Message Portal layout. Query keys go in `lib/api/queryKeys.ts`, strings in `web/src/lib/i18n/extra/{en,si}.json` under `mm.*`, checked by `check-i18n.mjs`.

#### 8.3.3 Report detail

Two columns on wide screens, stacked on narrow ones:

* **Left:**
  * Page viewer: thumbnail strip and large page with zoom (click to zoom, scroll to pan).
  * "Open PDF" (new tab, signed URL) and "Download PDF".
* **Right:**
  * meeting details, author, change summary;
  * native `<audio controls>` (signed URL, Range seeking);
  * **Versions** list (open any version, the withdrawn ones are greyed for admins with Restore);
  * **Comments** with filter All/Open/Addressed/Hidden. Each comment can be: replied to and marked addressed (publishers), hidden with a reason, or unhidden.
* **Admin actions menu:** "Withdraw this version" opens a `ConfirmDialog` that requires typing `v2` (the `typeToConfirm` option) plus a reason. "Start a revision" (publishers) also lives here.

#### 8.3.4 Office draft editor (D2)

Same steps as the phone, adapted to a PC:
* drag-and-drop or "Choose images" (multiple);
* a thumbnail grid with drag-to-reorder and keyboard reordering (Move earlier/later);
* rotate, replace and remove;
* **audio file upload** only (§6.6), with a chunked progress bar;
* preview PDF, then publish with the same checklist and `publish_ref`.

The author is recorded as the office user (P6). Mockup W5.

### 8.4 Notices and push

* **NoticeCard** (`mobile/src/ui/NoticeCard.tsx`) gains a `minutes` variant: a book icon, "Meeting minutes published" (or "…updated, v2"), the title, the meeting date and "Read and listen ›".
* **Notice detail** (`mobile/src/app/notice/[id].tsx`) shows an **"Open meeting minutes"** primary button using `meeting_report_id`.
* **Push tap** (`mobile/src/app/(tabs)/_layout.tsx:26-42`) handles the new types:
  * `minutes` and `minutes_comment` → `/meeting-records/{report_id}`;
  * `minutes_secretary` → the Secretary hub.
  * If `sam` is not the active society, the app calls `switchProfile(sam)` first (`AuthContext.tsx:150-163`). If that society's session has expired, its login screen opens and the report opens after sign-in.
* **Repeated taps:** opening the same notification twice opens the same screen once (the router replaces rather than stacks when the route is already on top).
* **Office web** Message Portal lists `minutes` notices with a "Meeting minutes" badge, linking to the report.

---

## 9. Reliability and idempotency

| Operation | Idempotency key | Retry result |
|---|---|---|
| Create report | `meeting_reports.client_ref` | Same report |
| Add page | `(version_id, client_ref)` | Same page, not a duplicate |
| Reorder | Full ordered list (last write wins) | Same order |
| Audio upload | `upload_id` + byte offset | Resumes from `received_bytes` |
| Publish | `publish_ref` | Same version, same notice, push not re-sent |
| Notice | `UNIQUE(meeting_version_id)` | Never two notices for one publication |
| Comment | `(report_id, client_ref)` | Same comment |

| Failure | What happens |
|---|---|
| Network drops mid-page-upload | Page tile shows "!"; local copy kept; auto-retry on reconnect/foreground; other pages continue. |
| App killed during upload or recording | On reopen the draft editor restores the queue and offers the unsaved recording. |
| PDF build fails | `PDF_FAILED`; draft unchanged; Retry. Publish is not attempted. |
| Publish response lost | Client retries with the same `publish_ref` → `already:true`; UI shows success. |
| Push service fails | Report is still published; the notice is in Notices; logged. |
| Secretary reassigned mid-draft | Next request returns `NOT_SECRETARY`; app explains and leaves; local pending uploads for that draft are discarded (they belong to the new Secretary's workflow now); server draft kept. |
| Two publishers edit the same draft (phone + office) | Last write wins per field. Page adds never conflict (separate rows). Reorder sends the full list and is rejected with `ORDER_MISMATCH` if the page set changed, prompting a refresh. |

---

## 10. Non-functional requirements

* **Performance:**
  * The list opens in under 1.5 s and a 12-page report's first page in under 3 s on 3G, by showing thumbnails first.
  * Audio starts in under 2 s (streamed, not downloaded first).
  * The page grid stays at 60 fps with 40 thumbnails on an Android Go class phone.
* **Accessibility:**
  * TalkBack labels in Sinhala and English ("Page 3 of 12", "Move page 5 earlier", "Recording, 24 minutes 10 seconds").
  * Font scale up to 200 %, targets ≥ 48 dp.
  * Reordering works without dragging.
  * Audio controls are labelled and the scrubber is adjustable by buttons.
* **Design gates:**
  * `check-contrast`, `check-type`, `check-motion` and `check-tokens` pass. The camera review and recorder screens use theme tokens; only if a dark camera overlay needs literal colours is the file added to the token allow-list (as `attendance/[id].tsx` is).
  * No new npm scripts in `mobile/package.json`, which changes the fingerprint.
* **Security:** server-side permission on every write (P1); private storage with signed URLs (§6.2); EXIF stripped; uploads type-sniffed; rate limits (§7.6).
* **Data:** published records kept forever; included in nightly backups (§6.1).
* **Web:** works in the desktop 1.4.0 shell. External links (opening the PDF) open in the system browser by the shell's existing rule (`src/main/shell.ts:77-88`), which is acceptable.

---

## 11. Release plan

Each phase ships on its own and leaves production consistent.

| Phase | Scope | Ships as | Exit criteria |
|---|---|---|---|
| **M0** | This document + mockups approved | — | Owner approval; open decisions settled or defaults accepted |
| **M1** | Officers: migration 020, `PATCH /users/:id`, Edit dialog, position + linked member, Active, officer trail, `permissions:['minutes']` | API + web deploy | Admin can assign a Secretary on the testbed; DB tests green |
| **M2** | Minutes server: migrations 021–022, private volume + backup, signed files, pages (sharp), PDF (pdf-lib), chunked audio, publish, notices, push with `sam`, comments, moderation, sweep | API deploy (needs the new volume first) | All §12.1 tests green; prod volume mounted and in the backup |
| **M3** | Web Meeting Records: browse, detail, audio, versions, comments, moderation, office draft editor and publish | Web deploy | Office can publish a report with an uploaded audio file on the testbed |
| **M4** | Mobile over the air on 1.6.1: list, reader (pages, PDF share), versions, comments, notice + push routing, Secretary hub and photo → PDF → publish **without** audio (audio areas show "update the app") | OTA to the 1.6.1 runtime, after `eas fingerprint:compare --build-id 94324b87` | Secretary publishes from a phone on the testbed; members read and comment |
| **M5** | 1.7.0 Play build: add `expo-audio` and `expo-document-picker`; remove `android.permission.RECORD_AUDIO` from `blockedPermissions` (`mobile/app.json:51-53`); microphone permission text; new camera permission text (today's says images "are not stored or sent anywhere", `app.json:93`, untrue once pages are photographed); recorder, audio upload, player | Play build (vc12), then OTA updates target its runtime | Data safety form updated; privacy page updated; full device test |

Phases M1–M3 do not touch the mobile app. M4 is pure JavaScript on modules already in the 1.6.1
binary (`expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-sharing`,
`expo-keep-awake`, gesture-handler, reanimated). The audio areas detect the native module
(§8.1.2) so the M4 bundle and the M5 bundle share one code path.

---

## 12. Testing and acceptance

### 12.1 Server (`node:test`, `*.db.test.js` pattern as `server/test/concerns.db.test.js`)

* `officers.db.test.js`:
  * Secretary requires a linked member;
  * one Secretary only (second gets `SECRETARY_TAKEN`; with `replace_secretary` it moves);
  * the member gains and loses `permissions:'minutes'`;
  * a disabled or deleted Secretary user loses publish power on the next request;
  * a linked member can't be deleted.
* `minutes.db.test.js`:
  * a non-Secretary member gets 403 on every write;
  * draft create is idempotent;
  * page add is idempotent;
  * reorder [3,1,2] → the PDF built has pages in that order (pdf-lib reads back each page's embedded image hash);
  * rotate is reflected;
  * publish is idempotent (twice → one version, one notice);
  * revision → v2 while v1 is unchanged;
  * comments span versions with their version tags;
  * withdraw hides v2 from members and falls back to v1;
  * year/month browse with two meetings in one month;
  * the successor Secretary sees and publishes the predecessor's draft, and v1's author is still the predecessor;
  * chunked audio resumes from an offset;
  * signed URL expiry and tampering are rejected;
  * draft files are refused to plain members.
* Add both to `test:db` **and to CI** (`.github/workflows/api.yml`, which today runs only the staffAuth and attendance DB suites).

### 12.2 Web

Vitest:
* the Edit user dialog validation (V1–V6);
* the reassignment confirmation;
* the browse filters;
* the comment status filter;
* the withdraw confirmation.

Plus `check:i18n` and an e2e flow on the testbed: assign Secretary → office publishes → member list shows it.

### 12.3 Mobile

* Design gates and `tsc`.
* The web preview harness for screenshots in Sinhala and English, light and dark.
* The owner's **device test plan on the testbed societies (DEM-9361 / TES-5155), never SAM-4217:**
  1. photograph 5 pages, rotate one, reorder, airplane mode mid-upload, recover;
  2. preview the PDF;
  3. publish;
  4. a second phone receives the push, opens the report, reads, listens (1.7.0) and comments "page 2";
  5. the Secretary marks it addressed in v2;
  6. reassign the Secretary in the office, then the old phone's next action is refused.

### 12.4 Brief acceptance criteria → tests

| Brief criterion | Verified by |
|---|---|
| Admin identifies the Secretary and links their member account through System Users | officers.db + web Edit dialog test + §12.3 |
| Linked Secretary sees creation controls and prepares a complete report from the phone | `permissions:'minutes'` test + device plan 1–3 |
| Publishing requests from other member accounts are rejected by the server | minutes.db 403 matrix |
| Reordering photographed pages produces a PDF in exactly that order | minutes.db reorder → PDF order |
| Secretary can preview, discard and replace a recording before publishing | §8.2.4 A2/A3 device test |
| Saved drafts reopen with their completed uploads and page order | minutes.db draft read-back + device plan (kill and reopen) |
| Publishing makes the report visible and creates a notice linking directly to it | minutes.db publish + notice `meeting_report_id` + device push tap |
| Members can read the PDF while listening | §8.1.2 A3 device test (1.7.0) |
| Members see others' correction comments and the version each refers to | minutes.db comments + §8.1.4 A1/A2 |
| A revision preserves earlier versions and the comment thread | minutes.db revision test |
| Reassigning the Secretary transfers access and keeps historical authors | minutes.db successor test |
| Office web shows published reports, versions, audio and comments | web e2e + §8.3 |
| Reports accessible across years and multiple meetings in a month | minutes.db browse test |
| Failed uploads and publish retries recover without duplicate reports or notices | minutes.db idempotency + §9 failure table on device |

---

## 13. Open decisions (each has a default; the build uses the default unless changed)

| # | Question | Default |
|---|---|---|
| OD1 | Who in the office may publish? | Administrators and the Secretary's own system user. |
| OD2 | May plain Staff hide comments? | Yes (Admins always). |
| OD3 | May members edit or delete their own comments? | Delete within 15 minutes; no editing (corrections are a record). |
| OD4 | Maximum recording length | 90 minutes. |
| OD5 | Maximum pages per version | 40. |
| OD6 | Sinhala for "Meeting Records" | රැස්වීම් වාර්තා (native reader to confirm, with §4.4). |
| OD7 | Do President/Treasurer positions get any powers? | None in v1 (labels for the officers list). |
| OD8 | Notify on a revision by default? | Off (the Secretary switches it on). |
| OD9 | Should members without the app get SMS? | No (out of scope). |

---

## 14. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | Storage and backup growth (~0.5 GB per society per year, full nightly tar) | Measure after 3 months; move `private/` to an incremental (rsync) backup if the archive passes 5 GB. |
| R2 | Secretaries unfamiliar with smartphones | One step per screen, auto-resume, office can publish on their behalf (D2), a short Sinhala how-to in Help. |
| R3 | Members still on 1.6.1 when audio launches | Capability detection shows an "Update to listen" prompt instead of a broken player. |
| R4 | Abusive or defamatory comments | Report → concern, hide by Secretary/office, rate limit, delete-own within 15 minutes. |
| R5 | A wrong file published (wrong book page, private photo) | Admin withdraw (instant for members), files retained for audit, typed confirmation. |
| R6 | Push opens under the wrong society | `sam` in every minutes push; switch before navigating. |
| R7 | New native modules break the 1.6.1 OTA line | Audio code paths guarded by `requireOptionalNativeModule`; `fingerprint:compare` before every OTA (M4 vs M5 runtimes). |
| R8 | Handwriting unreadable after compression | 2000 px / 0.8 on the phone, 2400 px cap on the server; verified with a real minute-book page before M4. |
| R9 | Long recordings over 3G | 64 kbps mono, chunked resumable upload, upload continues while the Secretary edits other steps. |

---

## Appendix A — Endpoint list

Member reading: `GET /me/meeting-records`, `GET /me/meeting-records/:id`, `GET /me/meeting-records/:id/versions/:no`, `GET|POST /me/meeting-records/:id/comments`, `DELETE /me/meeting-records/comments/:cid`, `POST /me/meeting-records/comments/:cid/report`.

Secretary: `GET /me/meeting-records/secretary`, `POST /me/meeting-records`, `POST /me/meeting-records/:id/revision`, `GET|PATCH|DELETE /me/meeting-records/:id/draft`, `POST /me/meeting-records/:id/draft/pages`, `PUT /me/meeting-records/:id/draft/pages/order`, `PATCH|DELETE /me/meeting-records/:id/draft/pages/:pid`, `POST /me/meeting-records/:id/draft/audio/uploads`, `PUT /me/meeting-records/:id/draft/audio/uploads/:uid`, `POST /me/meeting-records/:id/draft/audio/uploads/:uid/complete`, `DELETE /me/meeting-records/:id/draft/audio`, `POST /me/meeting-records/:id/draft/pdf`, `POST /me/meeting-records/:id/draft/publish`, `POST /me/meeting-records/comments/:cid/reply|addressed|hide|unhide`.

Office: `GET /meeting-records`, `GET /meeting-records/:id`, `GET /meeting-records/:id/versions/:no`, `GET /meeting-records/:id/comments`, the draft/publish set under `/meeting-records/:id/draft…` (publishers), `POST /meeting-records/comments/:cid/reply|addressed|hide|unhide`, `POST /meeting-records/:id/versions/:no/withdraw|restore`.

Users: `GET /users` (extended), `PATCH /users/:id` (new). Profile: `GET /me/profile` (`permissions` + `officer_position`). Files: `GET /files/:token`.

## Appendix B — Migrations

| # | Name | Contents |
|---|---|---|
| 020 | `020_officers` | `users.society_position`, `users.member_id`, `secretary_slot` + unique keys + FK; `officer_events` |
| 021 | `021_meeting_records` | `meeting_reports`, `meeting_report_versions`, `meeting_report_pages`, `meeting_audio_uploads`, `meeting_report_comments` |
| 022 | `022_announcement_minutes` | `announcements.meeting_report_id`, `meeting_version_id` + unique key |

Server dependencies added: `sharp`, `pdf-lib`. New env: `FILES_SECRET`. New volume: `/app/private`.
Mobile (M5 only): `expo-audio`, `expo-document-picker`.

## Appendix C — Copy (English / Sinhala, to be confirmed by a native reader)

| Key (mobile `mob.mm*`, web `mm.*`) | English | Sinhala (draft) |
|---|---|---|
| `title` | Meeting Records | රැස්වීම් වාර්තා |
| `minutes` | Meeting Minutes | සභා වාර්තා |
| `empty` | No meeting minutes yet. When the Secretary publishes the report of a meeting, it appears here. | තවම සභා වාර්තා නැත. ලේකම්වරයා රැස්වීමක වාර්තාව ප්‍රකාශයට පත් කළ විට එය මෙහි පෙනේ. |
| `meetingDate` | Meeting date | රැස්වීම් දිනය |
| `published` | Published {date} | ප්‍රකාශිතයි {date} |
| `version` | Version {n} | සංස්කරණය {n} |
| `pageOf` | Page {n} of {total} | පිටුව {n} / {total} |
| `sharePdf` | Save or share PDF | PDF සුරකින්න හෝ බෙදාගන්න |
| `listenUpdate` | Listening needs the latest app. Update eSamithi from Play Store. | සවන්දීමට නවතම යෙදුම අවශ්‍යයි. Play Store වෙතින් eSamithi යාවත්කාලීන කරන්න. |
| `olderVersion` | You are reading v{n}. A newer version is available. | ඔබ කියවන්නේ v{n} යි. නවතම සංස්කරණයක් ඇත. |
| `comments` | Comments | අදහස් |
| `commentHint` | Mention a page (page 3) or a time in the recording (12:34). | පිටුවක් (පිටුව 3) හෝ පටිගත කිරීමේ වේලාවක් (12:34) සඳහන් කරන්න. |
| `fixedIn` | Fixed in v{n} | v{n} හි නිවැරදි කළා |
| `secretaryBadge` | Secretary | ලේකම් |
| `newMinutes` | New meeting minutes | නව සභා වාර්තාවක් |
| `takePhoto` | Take photo | ඡායාරූපයක් ගන්න |
| `fromGallery` | From gallery | ගැලරියෙන් |
| `previewPdf` | Preview PDF | PDF පෙරදසුන |
| `record` | Start recording | පටිගත කිරීම අරඹන්න |
| `whatChanged` | What changed? | වෙනස් වූයේ කුමක්ද? |
| `notifyMembers` | Notify members | සාමාජිකයින්ට දැනුම් දෙන්න |
| `publish` | Publish | ප්‍රකාශයට පත් කරන්න |
| `publishConfirm` | Publish to all {n} members of {society}? They will get a notification. | {society} හි සාමාජිකයින් {n} දෙනාටම ප්‍රකාශයට පත් කරන්නද? ඔවුන්ට දැනුම්දීමක් ලැබේ. |
| `publishRetry` | We couldn't confirm the report was published. Tap Try again. It will not be published twice. | වාර්තාව ප්‍රකාශයට පත් වූ බව තහවුරු කළ නොහැකි විය. නැවත උත්සාහ කරන්න ඔබන්න. එය දෙවරක් ප්‍රකාශයට පත් නොවේ. |
| `notSecretary` | You are no longer the Secretary. Drafts stay with the society for the new Secretary. | ඔබ තවදුරටත් ලේකම් නොවේ. කෙටුම්පත් නව ලේකම්වරයා සඳහා සමිතිය සතුව පවතී. |
| `micWhy` | eSamithi needs the microphone to record you reading the minutes. The recording is shared only with your society's members. | සභා වාර්තාව කියවන ඔබේ හඬ පටිගත කිරීමට eSamithi හට මයික්‍රෆෝනය අවශ්‍යයි. එය බෙදාගන්නේ ඔබේ සමිතියේ සාමාජිකයින් සමඟ පමණි. |
| `position.secretary/president/treasurer/none` | Secretary / President / Treasurer / Unassigned | ලේකම් / සභාපති / භාණ්ඩාගාරික / පත් කර නැත |
| `linkedMember` | Linked member | සම්බන්ධ සාමාජිකයා |
| `secretaryNeedsMember` | Choose the member account this Secretary uses in the eSamithi app. | මෙම ලේකම්වරයා eSamithi යෙදුමේ භාවිත කරන සාමාජික ගිණුම තෝරන්න. |

## Appendix D — Brief → section traceability

| Brief item | Section |
|---|---|
| Identify the secretary through existing System Users; Access Role / Society Position / Linked Member fields | §3.1, §3.2 |
| Admins assign or change position and linked member | §2.2, §3.2 |
| Secretary requires a linked member | §3.2 V1 |
| Position and linked member shown in the list | §3.5 |
| One current Secretary; reassignment requires confirmation | §3.3, §5.1 |
| Creation and publishing permissions to the linked Secretary | §2.1, §3.7 |
| Applied within the selected society for multi-society members | §2.3 P3 |
| Enforced on the server for uploads, drafts, publication | §2.3 P1, §7.2 |
| Revoked on change, disable or delete; successor continues drafts and publishes revisions | §2.3 P2/P4, §3.3, §3.4 |
| Original author and publication details retained | §2.3 P5, §5.2 |
| Meeting Records under Society (web) and More (app) with a Meeting Minutes category | §4.1, §4.2 |
| Latest first; browse by year and month by meeting date; several meetings a month | §4.3 |
| Row shows meeting date, title, latest version, publication date | §4.3, §8.1.1 |
| Add Meeting Minutes for the Secretary; title and meeting date | §8.2.1, §8.2.2 |
| Save draft, reopen later; draft visible to the Secretary until publication | §5.4, §8.2, §9 |
| Complete photos, PDF and audio from the phone; publish when ready | §8.2 |
| Camera or existing images; one page at a time; numbered thumbnails | §8.2.3 |
| Reorder, preview, rotate, replace, remove | §8.2.3 |
| One PDF in the selected order; PDF preview; regenerate on change | §6.4, §8.2.3 |
| Readable text after compression | §6.3, §14 R8 |
| Upload and PDF progress with retry | §8.2.3, §8.2.5, §9 |
| Record in-app; upload existing audio; start/pause/resume/stop; playback; delete and re-record or replace; duration and progress | §6.5, §8.2.4 |
| Explain enabling microphone or camera | §8.2.4 |
| Completed uploads preserved when another fails | §8.2.3, §8.2.4 A4, §9 |
| Final preview with details, PDF and audio; explicit Publish | §8.2.5 |
| Available to members of that society; notice + push; opens the report | §7.4, §7.5, §8.4 |
| No duplicate publications or notices on repeated taps/retries | §7.4, §9 |
| Publish only after files are uploaded and ready | §7.4 step 4 |
| Latest version by default; PDF viewer with page navigation and zoom | §8.1.2 |
| Audio play, pause, seek, elapsed, total; read while listening | §8.1.2 |
| Meeting date and publication date shown clearly; retry on load failure | §8.1.2 |
| Every version kept with PDF, audio, time and author | §5.2, §5.4 |
| Revision draft; several changes published as one version; sequential numbers; change summary | §5.4, §7.2, §8.2.5 |
| Members open earlier versions via Version History | §8.1.3 |
| Existing version stays available while a revision is prepared | §5.4 |
| Secretary chooses whether to notify on a revision | §7.4 step 8, §8.2.5 |
| One comment thread per report across versions; name, time, version | §5.2, §8.1.4 |
| Page numbers or timestamps in comments | §8.1.4 |
| Secretary replies and marks addressed in a version; comments survive new versions | §7.2, §8.1.4 |
| Office: browse by year/month/date, read PDF, play audio, versions and summaries, comments and statuses | §8.3.2, §8.3.3 |
| Existing society access boundaries; English and Sinhala | §2.3 P3, §4.4, Appendix C |
| Acceptance criteria (14) | §12.4 |
