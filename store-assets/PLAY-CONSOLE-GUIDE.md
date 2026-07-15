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

Provide "All or some functionality is restricted" → add instructions:
```
eSamithi serves members of registered welfare societies. Reviewer test access:

1. Open the app → enter samithi code: DEM-9361
2. Log in as a member → NIC: 901234567V , PIN: 7391
   (if asked to enrol instead: NIC 901234567V, date of birth 1990-01-15,
    then choose any PIN)

This demo society contains synthetic data only. Language can be switched to
English from the More tab if it opens in Sinhala.
```

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
- [ ] App access demo credentials filled in and tested by you
- [ ] Screenshots show demo data only
- [ ] Internal-testing build verified: enrol, data loads, push arrives
