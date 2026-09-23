# eSamithi — Google Play Console Package (v1.3.0)

Everything you need to click through Play Console. Copy-paste the texts, use the exact
form answers, follow the order. Files referenced live in this `store-assets/` folder.

---

## 1. Create the app (Play Console → All apps → Create app)

| Field | Value |
|---|---|
| App name | **eSamithi** |
| Default language | **English (United Kingdom)** — Sinhala added as translation later |
| App or game | App |
| Free or paid | **Free** |
| Declarations | tick both boxes (Developer Program Policies, export laws) |

## 2. App signing — IMPORTANT, do this before the first upload

We must keep the **existing EAS signing key** as the app signing key, so the members who
already have the sideloaded APK (v1.1/1.2) can update from Play **without uninstalling**
(uninstall = they'd have to re-enrol with NIC + DOB + new PIN).

- Play Console → Setup → **App signing** (visible after you start the first release)
- Choose **"Use a different key"** → **"Export and upload a key from Java keystore"**
- I will run `eas credentials` to export the keystore + give you the upload file and
  passwords at that step — ping me when you reach this screen.
- If Play only offers "Let Google manage" without options, STOP and tell me before
  uploading any AAB (the first upload locks the choice).

## 3. Store listing (Grow → Store presence → Main store listing)

**Short description (≤80 chars):**
```
Your welfare society in your pocket — contributions, loans, notices & Puruka.
```

**Full description:**
```
eSamithi is the member app for community welfare societies (මරණාධාර හා සුභසාධක සමිති)
that manage their records on the eSamithi platform.

Ask your society for its join code, verify yourself with your NIC and date of birth,
choose a PIN — and your membership is in your pocket.

WHAT YOU CAN DO
• See your contributions and payment history, up to date
• Check your loans, guarantees and fixed deposits
• Read society notices — meetings, events and funeral announcements — with push
  notifications
• View your digital membership card with QR code for meetings
• See your society's funds transparently
• Send requests to your society (loans, certificates, information)
• Buy, sell, lend and borrow within your society on Puruka (පුරුක) — your society's
  own community exchange
• Full Sinhala and English support, light and dark themes

FOR SOCIETIES
Your society's office uses the eSamithi desktop application to manage members, finances
and communication. The mobile app is free for all enrolled members. Interested in
bringing your society onto eSamithi? Contact us at azyntra@gmail.com.

PRIVACY
Your data belongs to your society. No ads, no analytics, no selling of data — see our
privacy policy at https://api.esamithi.com/privacy
```

**Sinhala translation (add language → Sinhala — සිංහල):**
Short:
```
ඔබේ සමිතිය ඔබේ අතේ — දායක මුදල්, ණය, නිවේදන සහ පුරුක.
```
Full:
```
eSamithi යනු eSamithi වේදිකාවේ තම වාර්තා කළමනාකරණය කරන මරණාධාර හා සුභසාධක සමිති
සාමාජිකයන් සඳහා වූ යෙදුමයි.

ඔබේ සමිතියෙන් join code එක ලබාගෙන, ජාතික හැඳුනුම්පත් අංකය සහ උපන් දිනය මගින්
ඔබව තහවුරු කර, PIN අංකයක් තෝරන්න — ඔබේ සාමාජිකත්වය ඔබේ අතේ.

ඔබට කළ හැකි දේ
• දායක මුදල් සහ ගෙවීම් ඉතිහාසය බැලීම
• ණය, ඇපකරකම් සහ ස්ථාවර තැන්පතු පරීක්ෂා කිරීම
• සමිති නිවේදන — රැස්වීම්, උත්සව සහ අවමංගල්‍ය දැන්වීම් — push දැනුම්දීම් සමඟ
• QR කේතය සහිත ඩිජිටල් සාමාජික කාඩ්පත
• සමිතියේ අරමුදල් විනිවිදභාවයෙන් බැලීම
• සමිතියට ඉල්ලීම් යැවීම
• පුරුක — ඔබේ සමිතියේම හුවමාරු වෙළඳපොළ: අපේ දේ, අපි අතර
• සම්පූර්ණ සිංහල සහ ඉංග්‍රීසි සහාය

රහස්‍යතාව: ඔබේ දත්ත ඔබේ සමිතියට අයිතිය. දැන්වීම් නැත, දත්ත විකිණීම නැත.
https://api.esamithi.com/privacy
```

**Graphics:**
- App icon: `play-icon-512.png` (512×512)
- Feature graphic: `feature-graphic-1024x500.png`
- Phone screenshots: **minimum 2, take 4–8** on your Android phone signed into a
  **demo samithi** (never the real client's data). Suggested screens:
  1. Home (member summary)  2. Contributions/statement  3. Notices feed
  4. Membership card with QR  5. Puruka feed  6. Society funds
  Sinhala UI on half of them looks great for the local audience.

## 4. Store settings

- Category: **App → Finance** · Tags: your choice (e.g. "Financial management")
- Contact email: `azyntra@gmail.com` (public) · Website: `https://esamithi.com`

## 5. Privacy policy (Policy → App content)

```
https://api.esamithi.com/privacy
```
(Live after the prod TLS step. Don't submit for review before it's up.)

## 6. Data safety form (Policy → App content → Data safety) — exact answers

- Does your app collect or share user data? **Yes, collects. Shares: No.**
- Is all data encrypted in transit? **Yes**
- Do you provide a way to request deletion? **Yes** →
  `https://api.esamithi.com/privacy` (section 7 covers deletion requests)

Declare these collected types (all: **Collected, not shared · Required · Not for ads**):

| Category | Type | Purpose |
|---|---|---|
| Personal info | Name | App functionality, Account management |
| Personal info | Address | App functionality |
| Personal info | Phone number | App functionality, Account management |
| Personal info | Personal identifiers (NIC number) → "Other IDs" | Account management (enrolment verification) |
| Financial info | Other financial info (society contributions, loans, deposits) | App functionality |
| Photos & videos | Photos (Puruka listing photos, user-chosen) | App functionality |
| App activity | Other user-generated content (requests, listings) | App functionality |

Everything else (location, contacts, browsing, device IDs for ads, health…): **Not collected.**
Note: the Expo push token counts as "Device or other IDs" → declare **Device or other IDs —
Collected, App functionality** to be safe.

## 7. Content rating questionnaire (IARC)

- Category: **Utility / Productivity / Communication or other**
- Violence / sexuality / language / controlled substances: **No** to all
- Gambling (real or simulated): **No**
- Does the app share user location: **No**
- Digital purchases: **No** (in-app purchases: none)
- Expected rating: **Everyone / PEGI 3**

## 8. Target audience & content

- Target age group: **18 and over** (financial/membership app)
- Appeal to children: **No**
- News app: No · COVID app: No

## 9. Financial features declaration (Policy → App content)

Play asks all apps about financial features. Recommended answers (final call is yours):

- "Does your app provide any financial features?" → **My app doesn't provide any
  financial features**, with this reasoning if a description box appears:
```
eSamithi is a private member portal for registered community welfare societies
(mutual-aid / funeral-aid societies) in Sri Lanka. The app only DISPLAYS a member's
own standing with their society (contributions paid, benefits, society welfare loans
recorded by the society office) and delivers notices. It does not offer, broker,
process or facilitate loans or any financial product: no application processing,
no disbursement, no payments, no interest calculations offered to the public.
Welfare loans are internal society benefits handled offline at the society office
under the Societies Ordinance of Sri Lanka.
```
- If reviewers push back and require the **Personal Loans declaration**: declare
  "My app does not provide personal loans" (it displays records only). Never pick
  categories like loan broker/lender.

## 10. App access (for Google reviewers — the app needs credentials)

Provide "All or some functionality is restricted" → add the instructions below.
**Paste them exactly.** Every label in quotes is the app's own English wording,
checked on a clean Android 17 install on 23 Sep 2026.

```
eSamithi is for members of registered welfare societies, so it needs a
society code and a member login. This demo society contains synthetic data.

The app opens in Sinhala. Please switch it to English first:

1. On the first screen, tap "EN" at the top-left.
2. Tap "Get Started".
3. In "Samithi code", enter:  DEM-9361
   then tap "Find samithi".
4. It shows "You are connecting to: eSamithi Demo Society". Tap "Continue".
5. Tap "I already have a PIN".
6. NIC number:  901234567V
   PIN:         7391
   then tap "Log in".

You are now on the member's Home screen: dues status, membership card,
contributions, loan balance and notices. The tabs along the bottom are
Home, Puruka (marketplace), Contributions, Loans, Notices and More.
```

### Why this section was rewritten (vc7 rejection, 23 Sep 2026)

vc7 was rejected for **Broken Functionality — "Loading problems: your app doesn't
open or load."** The app itself was not broken: on a clean install on Android 17
with 16 KB memory pages it opens, signs in and loads every screen. What broke was
the reviewer's path into it, in two ways at once:

1. **The PIN on file had stopped working.** The demo member's PIN had been reset to
   something other than 7391, so a reviewer following these instructions could not
   log in. Nothing past the login screen was reachable.
2. **The instructions described a different app.** They said "Open the app → enter
   samithi code", but 1.4.0 opens on a welcome screen, in Sinhala, with two Sinhala
   buttons and no code field. They also said to switch to English "from the More
   tab" — which only exists after logging in. A reviewer who does not read Sinhala
   had no way to know which button led to the login.

### Keep the reviewer account working

- **DEMO-001 (NIC 901234567V) belongs to Google's reviewers. Never reset its PIN**,
  and never use it for your own testing. Anyone can reset it with "Forgot PIN?" and
  NIC + date of birth — which is exactly how the PIN on file stopped matching.
- Five wrong PINs lock the account for 15 minutes; a reviewer who arrives during a
  lockout sees a login that does not work.
- **Before every submission**, log in once on a phone with the exact credentials
  above. If it fails, fix the account before you submit, not after.
- **Whenever the first-run screens change**, re-walk these steps word for word and
  update the labels. The instructions must describe the build being reviewed.

## 11. Release

1. **Internal testing first**: Release → Testing → Internal testing → create release →
   upload the AAB I give you → add your own Gmail as tester → install via the Play link
   → we verify together (login over HTTPS, photos, push notification, OTA).
2. Then Production → create release → same AAB → roll out.
3. Countries: **Sri Lanka** (+ add others if you want the diaspora, e.g. UAE, Qatar,
   Kuwait, Saudi Arabia, South Korea, Japan, Italy, UK, Australia — many members work
   abroad; safe to add).
4. Review usually takes 1–7 days for a first submission.

## 12. Checklist before pressing "Submit for review"

- [ ] Privacy policy URL loads over HTTPS
- [ ] App signing uses the exported EAS key (step 2)
- [ ] Data safety + content rating + target audience + financial declaration done
- [ ] App access instructions walked word for word on a real phone against THIS build
- [ ] Demo login (DEM-9361 / 901234567V / 7391) succeeds immediately before submitting
- [ ] Screenshots show demo data only
- [ ] Internal-testing build verified: enrol, data loads, push arrives
