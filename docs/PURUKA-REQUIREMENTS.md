# Puruka (පුරුක) — Community Exchange Platform: Requirements & Implementation

_Status: **v1 in implementation (2026-07-08)**. Source: user-authored requirement sheet (this file is the engineering rendering of it). Supersedes the earlier "Village Marketplace (Pola)" draft._

## Concept

Puruka is a dedicated **community exchange platform** inside the eSamithi member app. Verified society members post goods, services, food items, farming items, household items and other useful resources for exchange within the local community.

Puruka is **not just second-hand selling**: it strengthens the community by encouraging reuse of unused items, supporting small home-based businesses, reducing unnecessary spending, and keeping value circulating among people who already know and trust each other.

Built around the community idea: **අපේ දේ, අපි අතර** ("our things, among us").

## Requirements

### P1. Posting (member)
- P1.1 Create posts directly in the member app; process simple, fast, suitable for users with low digital experience; minimal steps.
- P1.2 Post fields: photos (up to 3), category, title, price, description, contact phone (call/WhatsApp), location/area, availability status. Only essential fields required: **title + category + (price or negotiable)**; everything else optional.
- P1.3 Anything useful can be posted: an extra hammer, a rice cooker, a chair, usable wood, farming tools, pancakes/food items, services, rentals.

### P2. Categories (admin-manageable)
- P2.1 Stored in their own table so admins can add/rename/disable categories later **without changing past posts** (posts reference category id).
- P2.2 Seeded defaults: Household Items · Tools · Furniture · Farming Items · Food · Agriculture/Produce · Services · Rent/Borrow · Other (each with EN + සිං labels).

### P3. Price entry & community price notice
- P3.1 Price optional (with negotiable flag); the system never controls, limits, or calculates prices.
- P3.2 At the price step the app shows a gentle notice: **අපේ දේ, අපි අතර** — "If possible, try to offer a fair community price. This helps another family save money while giving value to you as well."

### P4. Browsing (member)
- P4.1 Card feed: photo, title, price, category, area, seller name, availability status.
- P4.2 Search & filters: category, keyword, location/area, price range, availability.

### P5. Contact & transactions
- P5.1 Contact poster via phone call and WhatsApp (in-app messaging = future option).
- P5.2 No online payments in v1: buyer and seller arrange payment/exchange directly. The system connects trusted members; it does not control the transaction.

### P6. Post management (owner)
- P6.1 Edit; mark **Available** ↔ **Sold/Completed**; delete (soft) or deactivate.
- P6.2 Sold/completed posts leave the active feed but are preserved for history/analytics.

### P7. Trust & safety
- P7.1 Only verified (active) society members can post; poster identity shown clearly (name, member-since).
- P7.2 Members can report inappropriate/false/suspicious posts; admins review reports and can deactivate. No per-post pre-approval in v1 (approval mode is a possible later switch).

### P8. Admin management (desktop)
- P8.1 View **all** posts; filter by category, member, status, keyword; see report reasons.
- P8.2 Deactivate (and reactivate) posts.
- P8.3 Manage categories (add, rename EN/සිං, enable/disable, order).
- P8.4 Configure the default post-expiration period (system Settings key `puruka_expiry_days`).

### P9. Expiration
- P9.1 Every post expires after the configured period (default 30 days).
- P9.2 Before expiry the system notifies the member (push, ~3 days ahead) with options: renew / mark sold / delete; the My Posts screen shows an expiring-soon warning with one-tap renew.
- P9.3 If no action: post becomes **Inactive** (leaves the feed) but is never hard-deleted — the member can renew/reactivate any time.

### P10. Technical rules
- Posts linked to the creating member; statuses `Active | Sold | Inactive | Removed | Deleted` (Removed = admin takedown; Deleted = owner soft-delete; Inactive = expired/deactivated).
- Soft-delete only; photos kept on disk except on hard cleanup.
- Puruka never touches Income/Expense/Wallet/Loan modules; member-to-member transactions are not society income.
- Designed so ratings, delivery, promotions, or in-app payments can be added later without redesign.

## Implementation map

- **Schema 008** (`ensureSchema()` + `migrations/008_puruka.sql`): `puruka_categories` (code, label_en, label_si, is_active, sort_order; 9 seeded), `puruka_posts` (member FK, category_id FK, title, description, price cents NULL, negotiable, phone, location, status, report_count, expiry_notified, sold_at, created_at, expires_at), `puruka_photos`, `puruka_reports` (UNIQUE listing+member); settings key `puruka_expiry_days` seeded ('30').
- **Photos:** multer → `uploads/puruka/`, random hex names, 5 MB cap, jpeg/png/webp; served at `/uploads` via express.static (CORP header relaxed); client compresses to ≤1280 px JPEG 0.7 (expo-image-manipulator).
- **Member API** `puruka.routes.js` → `/api/v1/puruka`: `GET /categories`; `GET /` (filters: category, q, location, min_price, max_price, avail; lazy expiry sweep); `GET /mine`; `GET /:id`; `POST /` (multipart, guards: active member, ≤5 Active); `PATCH /:id` (edit | sold | available | renew | deactivate); `DELETE /:id` (soft → Deleted); `POST /:id/report`.
- **Admin API** `purukaAdmin.routes.js` → `/api/v1/puruka-admin`: `GET /` (all posts + filters + report reasons), `PATCH /:id/deactivate|reactivate`, `GET/POST/PATCH /categories`.
- **Expiry notify:** server boot + every 12 h sweep → push (`sendPushToMembers`) to owners of posts expiring ≤3 days (`expiry_notified` flag; reset on renew).
- **Mobile:** 2nd tab `(tabs)/puruka.tsx` (icon `storefront-outline`, label පුරුක); `puruka/[id]`, `puruka-new` (fair-price notice at price field), `puruka-mine` (expiring-soon banner + renew); categories fetched from API with per-language labels; More-menu entry.
- **Desktop:** "Puruka" tab in the Message Portal page — post table with filters + deactivate/reactivate, category manager, expiry-days setting.
