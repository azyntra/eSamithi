# Firebase setup for push notifications (FCM v1) — 10 minutes, needs your Google account

Standalone Android builds receive push through Firebase Cloud Messaging. Two files come
out of this; hand both to me and I do the rest.

## A. Create the Firebase project + Android app

1. Go to https://console.firebase.google.com → **Add project**
   - Name: `eSamithi` (any name is fine)
   - Google Analytics: **disable** (not needed)
2. In the new project: **Add app → Android** (the robot icon)
   - Android package name: `lk.esamithi.member`  ← must be EXACTLY this
   - Nickname: eSamithi Member · SHA-1: leave empty
   - Register app → **Download google-services.json**  ← FILE 1
   - Skip the remaining "add SDK" steps (Expo handles it) → Continue to console

## B. Service account key (lets Expo's push service talk to FCM)

1. Firebase console → ⚙ **Project settings** → **Service accounts** tab
2. Click **Generate new private key** → confirm → a JSON file downloads  ← FILE 2
   (name looks like `esamithi-xxxxx-firebase-adminsdk-....json`)

## C. Hand over

Put both files somewhere I can read them, e.g.:
```
mobile/google-services.json          (FILE 1 — will be committed, that's normal)
mobile/fcm-service-account.json      (FILE 2 — NOT committed; I upload it to EAS and delete it)
```
Then tell me. I will:
- wire `google-services.json` into the app config
- upload the service-account key to EAS (`eas credentials` → FCM v1) and remove the local copy
- rebuild; after that, panel broadcasts with "push" tick will ring phones.
