# eSamithi Member Mobile App — UI/UX & Motion Refresh

**Status:** Draft for approval · **Date:** 21 September 2026 · **App:** eSamithi Member 1.3.1 (Android versionCode 6)
**Owner:** Sachira · **Applies to:** `mobile/` (Expo SDK 57, React Native 0.86)
**Depends on:** `MEMBER-MOBILE-APP-REQUIREMENTS.md` (what the app does) · `ESAMITHI-WEB-APP-REQUIREMENTS.md` §4 (the shared design system this aligns to)

---

## 0. Executive summary

The member app was described by its owner as looking "unprofessional", with animations that
"dance". This document specifies the fix.

The app is **not** badly built. It already has a token module, a genuinely sophisticated
language-aware type system, and a disciplined shared component kit. What it has is three
specific, measurable defects, and a design system that was only ever half-applied.

**1 · The dancing is a library regression, not a design choice.** Reanimated 4 changed the
default spring from `{damping:10, mass:1, stiffness:100}` to
`{damping:120, mass:4, stiffness:900}`. That new default is *critically damped* — it does not
bounce. But the app passes **partial** spring configs, so `mass` silently stays at 4 while
`damping` keeps a value chosen for the old library. Every spring in the app is therefore
running at a damping ratio between 0.12 and 0.25, which means 44–69 % overshoot and 1.6–2.3
seconds of visible wobble. A tap on any button in the app currently springs 1.3 % *larger*
than its resting size and oscillates for a second and a half. The active tab pill peaks at
**166 %** of its final size. This is the whole of the "dancing", and it is fixed by stating
three numbers instead of two.

**2 · The default language renders wrong.** Sinhala is the default language. 27 places set
`fontWeight` without a font family, which on Android silently falls back to the system
Sinhala face at *regular* weight — so most headings in the app are not bold for most users,
and the same places set no line height, so Sinhala's tall glyph stack crowds. Three of the
six Sinhala tab labels do not fit their slot and ellipsise: the primary navigation is
truncated in the language most members read.

**3 · Six of the palette's colour pairs fail WCAG AA**, including the primary blue both as
a text colour (3.68:1) and as a button fill under white text (3.68:1).

On top of those: 19 distinct font sizes for a six-step scale, roughly 50 % token adoption,
eight separate implementations of "a row inside a card" at six different heights, four
parallel status-badge colour maps, and no `FlatList` anywhere in an app that renders a
member's entire payment history into one scroll view.

**What this document specifies:** a corrected motion system with every value stated and
checked; the mobile expression of the shared eSamithi design system; a raised legibility
floor for an elderly, Sinhala-reading, low-end-Android audience; and a six-phase delivery
where every phase ships on its own over the air.

**What it deliberately does not do:** change the navigation, the six tabs, the features, or
the API. This is a refresh, not a rebuild.

---

## 1. Purpose, scope and decisions

### 1.1 Who this app is for

Members of a Sri Lankan village welfare society (a *maranadhara samithi* — a death-donation
society). They are largely elderly and rural, on budget Android phones, often on 3G, often
reading in sunlight. They open the app to answer four questions: *do I owe anything*, *what
have I paid*, *what do I owe on my loan*, and *has anyone died*. A small classifieds
marketplace (Puruka) sits alongside.

Design consequence: this is not an app that needs to be exciting. It needs to be legible,
calm and trustworthy — the qualities of a passbook, not of a consumer app.

### 1.2 Decisions taken with the owner

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D1 | How far to go | **Refresh** | Navigation, tabs, routes and features are untouched. Motion is fixed, the token migration is finished, and the worst screen compositions are rebuilt. |
| D2 | Visual direction | **Match eSamithi web/desktop** | One brand across all three surfaces: the same blue scale, the same neutrals, the same type rules, the same motion vocabulary. |
| D3 | Legibility | **Raise the floor** | Larger base type, ≥ 48 dp targets, fewer items per screen, and real support for the phone's own font-size setting. Less fits per screen; that is the intended trade. |
| D4 | Release route | **Over-the-air first** | Everything in phases 1–5 ships on the `prod` EAS channel. The app icon, splash, adaptive icon and notification colour are deferred to the next planned binary (phase 6). |

### 1.3 Out of scope

The tab structure and information architecture · any API or data-model change · the desktop
and web apps · the Puruka feature set · push notification behaviour · offline support ·
the app icon and splash (deferred to phase 6, not cancelled).

### 1.4 Non-negotiables

1. **No regression in what the app can do.** Every screen keeps its function.
2. **Sinhala is the default and is tested first.** Any change verified only in English is not verified.
3. **Every phase is shippable.** A half-finished refresh must never reach a member.
4. **`npx tsc --noEmit` stays green** — it is the only automated gate this project has.
5. **Three Android traps stay fixed.** SVG gradients must remain siblings of their Pressable, not children; Android `elevation` stays off large-radius cards; no `fontWeight` without a matching family.

---

## 2. Current state — the evidence

Every claim here was verified against the working tree on 21 September 2026 and cites
`file:line`. Contrast ratios were computed, not estimated.

### 2.1 Motion

Reanimated 4.5.0's `withSpring` default is `GentleSpringConfig = {damping:120, mass:4,
stiffness:900}` (`node_modules/react-native-reanimated/src/animation/spring/springConfigs.ts:28`),
merged with `{duration:550, dampingRatio:1}`. On its own that is critically damped: ζ = 1.00,
settling in ~267 ms with no overshoot. The previous major version defaulted to
`{damping:10, mass:1, stiffness:100}` (same file, line 6).

The app was written against the old defaults and passes partial configs. Because
`safeMergeConfigs` shallow-merges, an unspecified `mass` stays **4**:

| Where | As written | ζ | Overshoot | Settle |
|---|---|---|---|---|
| `src/ui/pressable.tsx:38,42` — **every tap**, 33 call sites | `{damping:20, stiffness:400}` | 0.25 | 44 % | **1.6 s** |
| `src/app/(tabs)/index.tsx:20` — Home, 7 staggered sections | `.springify().damping(18)` | 0.15 | 62 % (15.5 px past its mark) | 1.8 s |
| `src/app/(auth)/index.tsx:36,44,50,56,81` — Welcome, 5 elements | `.springify().damping(18)` | 0.15 | 62 % | 1.8 s |
| `src/ui/TabBar.tsx:69` — active tab pill | `ZoomIn.springify().damping(16)` | 0.13 | 66 % → **peaks at scale 1.66** | 2.0 s |
| `src/ui/TabBar.tsx:82` — unread badge | `ZoomIn.springify().damping(14)` | 0.12 | 69 % → **peaks at scale 1.69** | 2.3 s |
| `src/ui/toast.tsx:76` — toast, travelling a full window height | `SlideInDown.springify().damping(18)` | 0.15 | 62 % | 1.8 s of its 3 s life |
| `src/app/puruka/[id].tsx:133` — photo pager dots | `LinearTransition.springify().damping(18)` | 0.15 | 62 % → dot stretches to 28 px | 1.8 s |

ζ = damping / (2·√(stiffness · mass)); overshoot = e^(−πζ/√(1−ζ²)); settle ≈ 4/(ζ·ω₀).

**A second, quieter bug:** `.duration(420).springify()` silently discards the duration.
`springify(duration?)` assigns `this.durationV = duration`
(`ComplexAnimationBuilder.ts:99-100`), so calling it with no argument overwrites the value
with `undefined`. Every `.duration()` in the entering animations is dead code — the author
did try to bound these, and the API threw it away. The working form is `springify(420)`.

Three further motion defects, unrelated to springs:

* **Skeleton shimmer** (`src/ui/index.tsx:393`) — `withRepeat(withTiming(1, {duration:1100, easing: Easing.inOut(Easing.ease)}), -1)` with no `reverse`, so the highlight decelerates to a near-stop at each edge and then snaps back. It reads as a pulse, not a sweep. The Puruka loading state runs **12 of these at once**. The highlight is `rgba(255,255,255,0.55)` — very hot in light mode.
* **ProgressBar** (`src/ui/index.tsx:439`) — 650 ms, and every loan's bar fires simultaneously on the Loans list.
* **Reduced motion** is handled only by accident. Reanimated's own default (`ReduceMotion.System`) covers its animations; the `Modal` fade in `PhotoViewer.tsx:105`, the `slide_from_right` stack transition (`src/app/_layout.tsx:58`) and the `expo-image` cross-fades are not covered, and there is no in-app preference.

Motion that is already correct and must be left alone: `FadeIn.duration(300)` on `EmptyState`
and `ErrorView`; `SlideOutDown.duration(180)`; the `PhotoViewer` pinch/pan/zoom (180 ms);
`expo-image` `transition={150|180}`; the native stack transition; platform spinners;
`RefreshControl`.

### 2.2 Typography and Sinhala

Sinhala is the default language (`src/i18n/index.tsx:42`); English is opt-in.

`src/typography.tsx` is the best-informed file in the codebase. Its `useType()` hook returns
a font family chosen by language and a line-height function, and its header comment explains
exactly why: setting an Inter `fontFamily` on text containing Sinhala glyphs makes Android
fall back to the **system** Sinhala face at regular weight, so bold silently disappears.
Sinhala gets Noto Sans Sinhala at a 1.55 line-height ratio; Latin gets Inter at 1.35. Noto
Sinhala has no 800 cut, so `extrabold` aliases to Bold.

**That hook is not called in the places that need it most.** There are 27 raw `fontWeight`
usages across 14 files; 13 of those files never import `useType` at all:

```
src/app/(auth)/login.tsx        src/app/(auth)/samithi.tsx     src/app/(tabs)/contributions.tsx
src/app/benefits.tsx            src/app/dues.tsx               src/app/guarantees.tsx
src/app/help.tsx                src/app/loan/[id].tsx          src/app/payouts.tsx
src/app/puruka-mine.tsx         src/app/puruka-new.tsx         src/app/requests.tsx
src/app/society.tsx
```

For a Sinhala-reading member — the default — every "bold" heading on those screens is not
bold, and none of them sets a line height, so the glyph stack crowds between lines.

**Sinhala also overflows in four known places:**

| Where | Constraint | The Sinhala string |
|---|---|---|
| Tab labels (`src/ui/TabBar.tsx:102-109`) | `fontSize:10.5`, `numberOfLines:1`, `maxWidth:76`, ~60 dp per tab on a 360 dp phone | `මුල් පිටුව` (10), `දායක මුදල්` (10), `දැනුම්දීම්` (10) — all ellipsise |
| Home quick actions (`src/app/(tabs)/index.tsx:212-217`) | `fontSize:11`, `numberOfLines:2`, ~80 dp | `සාමාජික කාඩ්පත` |
| Theme segmented (`src/app/(tabs)/more.tsx:162-170`) | one non-scrolling row | `පද්ධතිය / ආලෝක / අඳුරු` |
| `Money` (`src/ui/index.tsx:201-208`) | fixed size, no `adjustsFontSizeToFit` | `Rs. 1,250,000.00` beside a Sinhala label squeezes the label |

**The scale is not a scale.** `src/theme.tsx:78` defines six sizes
(`display 28 · title 22 · heading 17 · body 15 · caption 13 · micro 12`) and is imported by
exactly one file. Nineteen distinct sizes are actually in use, six of them fractional:

```
9.5  10.5  11  12  12.5  13  13.5  14  15  15.5  16  16.5  17  18  22  24  26  34  100
```

### 2.3 Colour and contrast

Computed with the WCAG 2.1 relative-luminance formula. AA requires 4.5:1 for body text.

| Pair | Today | Result |
|---|---|---|
| `primary #3b82f6` as a link or icon on white | **3.68:1** | ✗ fails |
| White label on a `#3b82f6` button | **3.68:1** | ✗ fails |
| `warning #d97706` on `warningBg #fef3c7` (13 px) | **2.86:1** | ✗ fails |
| `success #16a34a` on `successBg #dcfce7` (13 px) | **3.00:1** | ✗ fails |
| `danger #dc2626` on `dangerBg #fee2e2` (13 px) | **3.95:1** | ✗ fails |
| `textMuted #64748b` on `bg #f1f5f9` | **4.34:1** | ✗ fails |
| Body text `#0f172a` on `surface #ffffff` | 17.85:1 | ✓ |

Three further colour defects:

* **The brand blue never adapts.** `primary`, `gradStart`, `gradEnd` and `navy` are byte-identical in the light and dark palettes (`src/theme.tsx:16-22` vs `:41-46`), so the gradient hero and every primary button are the brightest thing on a dark screen.
* **Three different blues ship.** `#1E64D4` in the app, `#1E6FD0` as both the Android adaptive-icon background and the notification accent (`app.json`). The notification shade shows a different blue from the app.
* **`primarySoft #e8f0fe` carries nine semantic roles** — tab pill, nav icon chips, row icon chips, quick actions, filter chips, category chips, secondary buttons, empty state, error state — so nothing reads as more important than anything else. Home alone shows five circular-chip sizes (30/34/44/46/72) in that one tint.
* The membership-card status badge hardcodes `#166534`/`#bbf7d0`/`#7f1d1d`/`#fecaca` (`src/ui/MembershipCard.tsx:74-75`) and so ignores dark mode entirely.

### 2.4 Structure and consistency

* **Zero `StyleSheet.create`** in the codebase; 370 inline style object literals.
* **Zero `FlatList` or `SectionList`.** Every list is `.map()` inside one `ScrollView` — including the infinite-scroll marketplace and a member's entire payment history.
* **Eight implementations of "a row inside a card"**, at six different vertical paddings (10/12/13/14/18 px): `more.tsx:71`, `more.tsx:112`, `contributions.tsx:62`, `payouts.tsx:35`, `benefits.tsx:29`, `loan/[id].tsx:80`, `society-funds.tsx:37`, `samithi.tsx:108`, `help.tsx:42`.
* **Four parallel status-badge colour maps**: `StatusBadge` (`src/ui/index.tsx:519`), `requests.tsx:17-26`, `puruka-mine.tsx:40-50`, `puruka/[id].tsx:58-66`.
* **Three chip styles**, two of them byte-identical copies (`notices.tsx:67-85`, `puruka.tsx:250-268`) and a third at a different radius and weight (`puruka-new.tsx:205-226`).
* **Three "big number in a box" variants** (`contributions.tsx:50`, `dues.tsx:38`, `society-funds.tsx:76`), the last bypassing `formatCurrency` and hand-building its `Rs. …` string.
* **Six raw copies of the same error-text style**, while `Input` has an `error` prop that nothing uses.
* **Screen padding drifts 16 / 20 / 24** between the tab shell, New Request and the auth screens, so text left-edges jump across a push transition.
* **Token arithmetic defeats the grid**: `spacing.lg - 2`, `spacing.sm + 1`, `spacing.md - 2`, `radius.md - 4`.

### 2.5 Accessibility, as it stands

| Concern | Today |
|---|---|
| `accessibilityLabel` | **3** in the whole app; one of them is hardcoded English (`PhotoViewer.tsx:112`) |
| `accessibilityHint`, `accessibilityLiveRegion`, `hitSlop` | **0 each** |
| OS font scaling | No `allowFontScaling`, `maxFontSizeMultiplier`, `PixelRatio` or `fontScale` anywhere. Text does scale, but `lineHeight` is computed from a fixed design size and does not — at large sizes Sinhala ascenders clip first |
| Touch targets | `Button` is 52 dp (good); `Segmented` options are ~34 dp (below the 44 dp minimum) — and that control is both the language and the theme switcher |
| Contrast | Six failing pairs, §2.3 |
| Reduced motion | Accidental coverage only, §2.1 |

`MEMBER-MOBILE-APP-REQUIREMENTS.md:125` promises "large touch targets, dynamic font scaling,
high contrast". Today that is an aspiration, not a fact. This document makes it true.

### 2.6 What is already good, and must survive

Worth stating plainly, because a refresh can destroy it by accident:

* `src/typography.tsx` — the language-aware type system, and the Android knowledge in its comments.
* `Card`'s deliberate removal of Android `elevation` (`src/ui/index.tsx:78`) because it smudges around large corner radii on real devices.
* The gradient-as-sibling pattern (`src/ui/index.tsx:236-245`) that keeps SVG from swallowing touches on Android — this cost two separate bug-fix commits.
* Always-labelled tabs, chosen because "many members are elderly and icon-only navigation loses them" (`src/ui/TabBar.tsx` header).
* `Money` always rendering in Inter with `tabular-nums`, so amounts align.
* A single, honest token module with a comment admitting its own partial adoption.
* Light/dark parity across every shared component.
* No emoji used as iconography anywhere.

---

## 3. The design system

### 3.1 Principles

1. **Motion explains, never entertains.** Every animation answers "what just happened?" or "where did that come from?". Nothing bounces. (Taken verbatim from the web app, and the direct answer to the owner's complaint.)
2. **Legible before elegant.** When density and readability conflict, readability wins. The reader may be 70 and in sunlight.
3. **Sinhala is the design language, not a translation.** Type, line height, label length and layout are designed for Sinhala first and checked in English second.
4. **One eSamithi.** A member's app and the officer's desktop are visibly the same product.
5. **The token is the only number.** No literal spacing, size, radius or colour in a screen file. No arithmetic on tokens.
6. **Calm surfaces.** One accent colour, one card shape, one row height, generous whitespace, no decoration that does not carry meaning.

### 3.2 Motion — the core of this refresh

A new module, `mobile/src/motion.ts`, is the only place motion values exist. **Rule: no call
site may pass a partial spring config.** Every spring states `damping`, `stiffness` *and*
`mass`, because omitting `mass` is the entire bug described in §2.1.

```ts
// mobile/src/motion.ts
import { Easing, ReduceMotion } from 'react-native-reanimated'

// Reanimated 4's own default is critically damped (damping 120, mass 4,
// stiffness 900 -> zeta = 1.00, ~267ms). These tokens keep that character and
// state every field, so no future edit can half-override one and reintroduce
// the wobble this module was written to remove.
export const SPRING = {
  /** Screen and section entrances. zeta = 1.00, settles ~210ms. */
  enter:  { damping: 38, stiffness: 360, mass: 1, reduceMotion: ReduceMotion.System },
  /** Anything that should feel physical but must never overshoot. zeta = 1.00, ~267ms. */
  settle: { damping: 120, stiffness: 900, mass: 4, reduceMotion: ReduceMotion.System },
} as const

export const TIMING = {
  press: { duration: 90,  easing: Easing.out(Easing.quad) },
  fast:  { duration: 150, easing: Easing.out(Easing.quad) },
  base:  { duration: 220, easing: Easing.out(Easing.cubic) },
  page:  { duration: 320, easing: Easing.out(Easing.cubic) },
} as const

/** First-mount stagger only: 30ms per item, at most 3 items. */
export const stagger = (i: number): number => Math.min(i, 2) * 30
```

**Token table** — as built. Every value computed, not estimated.

| Token | Value | ζ | Settle | Used for |
|---|---|---|---|---|
| `dur.pressIn` / `dur.pressOut` | `withTiming` 90 / 140 ms, `ease.press` in, `ease.standard` out | — | 90 / 140 ms | Every tap. Asymmetric on purpose: the finger drives the press down, the release settles. A curve, not a spring — structurally incapable of wobbling |
| `dur.micro` | 150 ms | — | 150 ms | Tab pill, unread badge, chips, pager dots |
| `dur.exit` | 160 ms | — | 160 ms | Every exit — deliberately shorter than its entrance |
| `dur.content` | 160 ms | — | 160 ms | Skeleton giving way to content, on `Screen` |
| `dur.gesture` | 180 ms | — | 180 ms | Photo zoom/pan and image cross-fades. Already correct; tokenised, not changed |
| `dur.surface` | 220 ms | — | 220 ms | Toast, banner |
| `dur.enter` | 260 ms | — | 260 ms | Welcome-screen arrivals, empty and error states |
| `dur.page` | 320 ms | — | 320 ms | Progress fill. Also roughly the native stack transition, which is left alone |
| `dur.stagger` | 30 ms per item | — | — | Welcome screen only |
| `dist.rise` | 12 px | — | — | How far an entering element travels. Short, because `ease.enter` is front-loaded |
| `SPRING.settle` | `{damping:120, stiffness:900, mass:4}` | **1.00** | ~390 ms | The only spring left in the app. Reanimated 4's own Gentle numbers, stated in full |

Easings: `ease.standard` `bezier(.2,0,0,1)` · `ease.enter` `bezier(0,0,0,1)` · `ease.exit`
`bezier(.3,0,1,1)` · `ease.press` `Easing.out(Easing.quad)` · `ease.pulse`
`Easing.inOut(Easing.quad)`. This is the web app's 80/150/220/320 ladder
(`ESAMITHI-WEB-APP-REQUIREMENTS.md` §4.5); mobile's press token is 90 ms rather than 80 ms
because a touch has no hover state to precede it.

**Bezier easings are `.factory()`'d once at module scope.** Built per render they allocate a
new worklet each time, and an un-factoried curve handed to a layout builder trips
`assertEasingIsWorklet` in dev and misbehaves silently in release.

**Per-interaction, as built.**

| Interaction | Was | Now | Where |
|---|---|---|---|
| Any press | spring ζ 0.25, 44 % overshoot, 1.6 s | 90 ms down, 140 ms back | `src/ui/pressable.tsx` |
| Tab switch | pill `ZoomIn` peaking at 1.66, 2.0 s | `FadeIn` 150 ms. **Not** a duration-solved spring: that solver runs a 100-iteration bisection on the UI thread at every start, and this fires on every press | `src/ui/TabBar.tsx` |
| Unread badge | `ZoomIn` peaking at 1.69, 2.3 s | `FadeIn` 150 ms. No pop, ever — this badge counts death notices | `src/ui/TabBar.tsx` |
| Home opens | 7-section cascade, still moving after 2.2 s | The cascade is **deleted**. Home is a tab screen that expo-router keeps mounted, so it fired once per launch and never again | `src/app/(tabs)/index.tsx` |
| Skeleton → content, every screen | a hard cut — the skeleton `Screen` unmounts and a content `Screen` mounts | one 160 ms crossfade, moved onto `Screen` so all 18 screens get it | `src/ui/index.tsx` |
| Welcome | 5 elements, 62 % overshoot each, ~2.1 s | 5 elements, 260 ms each, 30 ms apart, 12 px rise — 380 ms total. The one stagger that earns its keep | `src/app/(auth)/index.tsx` |
| Toast | `SlideInDown` sprang the layout `originY` a full window height; flat 180 ms exit | `FadeInDown` 220 ms in, `FadeOutDown` 160 ms out — symmetric, and it rises into place because it is anchored at the bottom | `src/ui/toast.tsx` |
| Pager dots | `LinearTransition` spring — one swipe shuffled the whole row for 1.8 s | fixed 20 × 7 slot, inner bar `scaleX` 0.35 ↔ 1.0 at 150 ms. Nothing changes layout, so nothing else moves | `src/app/puruka/[id].tsx` |
| Skeleton | 12 independent 1100 ms sweeps, `Easing.inOut` and no `reverse`, so a white bar snapped back each cycle | one shared 900 ms opacity breath, `reverse: true`, in phase everywhere | `src/ui/index.tsx` |
| Progress fill | 650 ms, and `scaleX` squashed the fill's own rounded cap | 320 ms; the radius moved to the track | `src/ui/index.tsx` |
| Stack push · photo zoom · empty/error fade | already correct | unchanged — tokenised and reduced-motion gated only | — |


**Banned outright**, in this codebase, permanently:

* `.springify()` with no argument after a `.duration()` — it discards the duration. Use `springify(220)`.
* Any `withSpring` config that omits `mass`.
* `ZoomIn` / `ZoomOut` on anything that is not a photo viewer.
* `withRepeat` on anything except the skeleton shimmer.
* Any animation over 400 ms that is not a stack transition.
* Stagger beyond 3 items, or on anything but a first mount.

**Reduced motion is explicit.** `reduceMotion: ReduceMotion.System` is stated on every token
rather than inherited silently, and the three things Reanimated cannot see — the
`PhotoViewer` `Modal` fade, the native stack transition and the `expo-image` cross-fades —
are gated on `useReducedMotion()`, re-exported from the same module.

### 3.3 Typography

**One scale, six sizes, no fractionals.** The body rises 15 → 16 px (decision D3).

| Token | Size | Weight | Line height (Latin ×1.35) | Line height (Sinhala ×1.55) | Used for |
|---|---|---|---|---|---|
| `display` | 28 | Bold | 38 | 43 | The one big number on a screen (total owed, total contributed) |
| `title` | 22 | Bold | 30 | 34 | Screen titles, the Home greeting |
| `heading` | 18 | SemiBold | 24 | 28 | Card titles, section headings |
| `body` | 16 | Regular / SemiBold | 22 | 25 | Everything a member reads |
| `label` | 14 | SemiBold | 19 | 22 | Row labels, captions, metadata |
| `micro` | 12 | SemiBold | 16 | 19 | Badges, tab labels, timestamps |

Rules:

1. **Every `Text` gets its family from `useType()`.** No exceptions, no `fontWeight` outside `src/typography.tsx`. This single change fixes bold for the majority of users.
2. **Every `Text` gets a line height** from `ty.lh(size)`.
3. **Money is always Inter with `tabular-nums`**, never the Sinhala face, so columns align (already true in `Money` — keep it).
4. **Line height follows the scaled size**, not the design size: `ty.lh(size * PixelRatio.getFontScale())`, so Sinhala ascenders do not clip when a member raises their phone's text size.
5. **`maxFontSizeMultiplier`** is set only where layout genuinely cannot reflow — tab labels (1.3) and badges (1.2). Nowhere else.
6. Sinhala never exceeds weight 700 (Noto has no 800 cut).

### 3.4 Colour

Adopting the web app's scale (decision D2) fixes six AA failures at the same time. All
ratios below are computed.

**Light**

| Token | Today | Proposed | Check |
|---|---|---|---|
| `primary` | `#3b82f6` | **`#1E64D4`** | text/icon on white 3.68 → **5.48:1** ✓ |
| `onPrimary` on `primary` | white, 3.68:1 ✗ | white on `#1E64D4` | **5.48:1** ✓ |
| `primarySoft` | `#e8f0fe` | **`#EEF4FE`** | `primary` on it **4.96:1** ✓ |
| `textMuted` | `#64748b`, 4.34:1 ✗ | **`#475569`** | on `bg` **6.92:1** ✓ |
| `success` | `#16a34a`, 3.00:1 ✗ | **`#166534`** | on `successBg` **6.49:1** ✓ |
| `warning` | `#d97706`, 2.86:1 ✗ | **`#B45309`** | on `warningBg` **4.51:1** ✓ |
| `danger` | `#dc2626`, 3.95:1 ✗ | **`#B91C1C`** | on `dangerBg` **5.30:1** ✓ |
| `bg` / `surface` / `surfaceAlt` / `text` | `#f1f5f9` / `#ffffff` / `#f8fafc` / `#0f172a` | unchanged | body text **17.85:1** ✓ |

**Dark** — the brand must finally adapt (§2.3):

| Token | Today | Proposed | Check |
|---|---|---|---|
| `primary` | `#3b82f6` (same as light) | **`#4C8DF6`** | on `surface` **5.11:1** ✓ |
| `onPrimary` | `#ffffff`, 3.68:1 ✗ | **`#0F172A`** (navy on the lighter blue) | **5.48:1** ✓ |
| `primarySoft` | `#1e2f55` | **`#1B2B4D`** | chip text uses `#85B0F2` → **6.33:1** ✓ |
| `textMuted` | `#94a3b8` | unchanged | on `bg` **7.30:1** ✓ |
| `success` / `warning` / `danger` | `#4ade80` / `#fbbf24` / `#f87171` | unchanged | 8.55 / 8.97 / 5.84:1 ✓ |

**Gradient.** `gradStart #3b82f6 → gradEnd #1E64D4` in light. In dark it becomes
`#2E75E3 → #1854B8`, so the hero stops being the brightest object on the screen.

**`primarySoft` gets one job: the selected state of a control** (tab pill, selected chip,
secondary button). Everything that used it as decoration — nav icon chips, row icon chips,
quick actions, empty state, error state — moves to `surfaceAlt`. This is what restores
hierarchy: when only selection is blue, selection is visible.

**Icon chips get two sizes, not five:** 40 dp inside a row, 56 dp for an empty or error
state. The 30/34/44/46/72 spread on Home disappears.

**Membership card badge** stops hardcoding four hex values (`src/ui/MembershipCard.tsx:74-75`)
and uses `success`/`successBg` and `danger`/`dangerBg` so it follows the theme.

### 3.5 Spacing, radius, elevation

Spacing keeps the 4-pt grid and **gains the steps people were faking** with arithmetic, so
`spacing.lg - 2` has a name:

```
spacing = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32 }   // unchanged
radius  = { sm:8, md:12, lg:16, xl:24, pill:999 }                // aligned to the web app
```

* Arithmetic on a token is banned. If a value is needed that the scale lacks, the scale is wrong — add the step.
* **One screen padding: `spacing.lg` (16).** The 16/20/24 drift between the tab shell, New Request and the auth screens ends; text left-edges no longer jump across a push.
* **One card**: `radius.lg`, `spacing.lg` padding, 1 px hairline, iOS-only shadow (`elevation.sm`), Android `elevation` stays off — see §2.6.
* **One row height**: 56 dp minimum, replacing the six current values.
* Elevation is unchanged and already well-behaved.

### 3.6 Components

New or reworked in `mobile/src/ui/`. Each one exists to delete duplication found in §2.4.

| Component | Replaces | Notes |
|---|---|---|
| **`ListRow`** | 8 hand-rolled row implementations at 6 heights | Icon chip (40 dp, optional) · label · value · chevron (optional) · separator handling · `onPress`. Minimum 56 dp. The single most duplicated pattern in the app |
| **`StatusPill`** | 4 parallel colour maps (`StatusBadge`, `requests.tsx:17`, `puruka-mine.tsx:40`, `puruka/[id].tsx:58`) | One status vocabulary, one colour map, every value translated, a leading dot so state survives colour blindness |
| **`Chip`** | 3 chip styles, two of them copy-paste | Selected / unselected, one radius, one height (36 dp), `accessibilityState.selected` |
| **`AmountCard`** | 3 "big number in a box" variants | Label + `Money` at `display`, optional tone; always via `formatCurrency` |
| **`Input`** (rework) | 6 raw copies of the same error text | Adopt the existing unused `error` prop. Filled background (`surfaceAlt`) so the border is not load-bearing; focused border `primary` (5.48:1 light / 5.11:1 dark) |
| **`Card`** (rework) | screens overriding `paddingVertical` with raw numbers | Explicit `padded` / `list` variants |
| **`Screen`** (rework) | — | Gains a `FlatList` mode so long lists stop rendering into one `ScrollView` |
| **`Segmented`** (rework) | — | Minimum 48 dp tall (from ~34), and it wraps or scrolls rather than crushing Sinhala |

### 3.7 Lists

`FlatList` replaces `.map()` wherever the list is unbounded: Contributions (a member's whole
payment history), Notices (the whole archive), Puruka feed (paged), Payouts, Requests,
Guarantees. `keyExtractor`, `getItemLayout` where rows are fixed, and `ListEmptyComponent`
wired to the existing `EmptyState`.

---

## 4. Screen specifications

Only the screens whose composition changes are specified here. Every other screen inherits
the new tokens, type, motion and components without a layout change — that is the point of
decision D1.

### 4.1 Home (`src/app/(tabs)/index.tsx`) — the priority

**Today** it is seven unrelated card shapes in one scroll: a greeting with a 44 dp gradient
avatar, a compact membership card, a conditional dues banner, a notice card with a coloured
left border, two stat cards with 34 dp chips, a four-item quick-action row with 46 dp chips
and no container, and an activity list card. Section headings appear above only three of
them, and the dues heading renders conditionally (`:130`), so the page's rhythm changes
depending on whether the member owes money. Eight distinct font sizes appear on this one
screen.

**Required composition** — one question answered per block, in the order a member asks them:

1. **Header.** Greeting at `title`, member ID and join date at `label`/muted, avatar 40 dp. Not a section — it is the page's own title.
2. **Status.** *The* answer to "do I owe anything", always present, never conditional: one card, `danger` / `warning` / `success` tone, the amount at `display` when something is owed, tappable through to Dues. This replaces the conditional banner stack and fixes the rhythm problem.
3. **Membership card.** Unchanged in content; it is the emotional anchor and members show it at the office.
4. **Two figures.** Total contributed · loan balance, as `AmountCard`s. Icon chips 40 dp, `surfaceAlt` not `primarySoft`.
5. **Latest notice**, if any. One card, type colour on the icon and label only — the 4 px left border goes; it is the only element in the app using that device.
6. **Quick actions.** Four `ListRow`s in one card rather than four unlabelled circles — at 16 px Sinhala, a label under a 46 dp circle cannot fit (§2.2) and a row can.
7. **Recent activity.** Five `ListRow`s in one card.

Every block gets a `SectionHeader`, or none does. Stagger is limited to the first three
blocks (§3.2).

### 4.2 Dues (`src/app/dues.tsx`)

The most important screen in the app after Home, and today it is a plain stack of cards.
Required: total owed as a single `AmountCard` at `display`; then one card per overdue loan
using `ListRow` for the principal/interest/fine breakdown; then the membership-fee section;
then the existing empty state when the member is clear. No layout invention — just the new
row, the new amount treatment and the new type scale.

### 4.3 Contributions (`src/app/(tabs)/contributions.tsx`)

Convert to `FlatList` with month headers (`SectionList` is acceptable here). Summary
`AmountCard` becomes the list header. Rows become `ListRow`. This screen currently renders a
member's entire payment history into one `ScrollView` — after several years of monthly dues
that is the app's first real performance ceiling.

### 4.4 Loans (`src/app/(tabs)/loans.tsx`) and loan detail (`src/app/loan/[id].tsx`)

Status as `StatusPill`. Amounts through `AmountCard` / `Money` — the detail screen currently
hand-builds repayment subtitles with `/100 .toLocaleString()` (`loan/[id].tsx:95-96`), which
drops the `Rs.` prefix and the two-decimal rule every other screen follows; route it through
`formatCurrency`. Progress bar ≤ 400 ms, and on the list the bars animate only on first
mount, not on every re-render.

### 4.5 Notices (`src/app/(tabs)/notices.tsx`)

Filter chips become `Chip`. Notice cards keep the type icon and label but drop the 4 px
coloured left border in favour of a tinted icon chip, so they match every other card in the
app. `FlatList`.

### 4.6 Tab bar (`src/ui/TabBar.tsx`)

The active indicator **slides** rather than zooming (§3.2). Labels stay — they are a
deliberate accessibility decision (§2.6) — but the three long Sinhala labels must be
shortened to fit ~60 dp at `micro`, and **this needs a Sinhala speaker's sign-off, not a
developer's guess** (§9, open decision O1). `maxFontSizeMultiplier: 1.3`.

### 4.7 Welcome (`src/app/(auth)/index.tsx`)

`:23-27` redirects to the samithi-code screen whenever there is no pending profile, so a
first-time member never sees the Welcome screen — the brand moment, the logo, the tagline —
until they come back from entering a code. Reverse the order: Welcome first, then the code
screen. This is a two-line change and it is the app's first impression.

### 4.8 Puruka new/edit (`src/app/puruka-new.tsx`)

Five validation failures currently raise `Alert.alert('', message)` — an OS dialog with an
empty title (`:101-117`) — while every other form in the app shows inline text. Use the
`Input` `error` prop.

---

## 5. Accessibility requirements

WCAG 2.1 AA is the bar, adapted to a native app and to this audience.

| # | Requirement | How it is checked |
|---|---|---|
| A1 | Every text pair reaches 4.5:1; every control boundary and state indicator 3:1 | Script over the palette (§8) |
| A2 | Every interactive element ≥ 48 dp in both dimensions | Review; `Segmented` and the Puruka clear-search button are the known failures |
| A3 | Every icon-only control has a translated `accessibilityLabel` | `grep` — today there are 3 labels app-wide, one hardcoded English |
| A4 | `ListRow` announces label and value as one unit (`accessible`, composed label) | Screen-reader pass on Home and Dues |
| A5 | Text scales to 200 % without clipping or loss of function; line height scales with it | Device pass at maximum OS font size, in Sinhala |
| A6 | Reduced motion honoured explicitly, including `Modal`, stack and image transitions | Device pass with the OS toggle on |
| A7 | Colour is never the only carrier of meaning | `StatusPill` keeps its leading dot and gains a distinct label per state |
| A8 | Toasts and scan feedback announce via a live region | Screen-reader pass |
| A9 | Every new string exists in both `en.ts` and `si.ts` | Parity check in CI (§8) |

---

## 6. Non-functional requirements

| # | Requirement |
|---|---|
| N1 | Cold start no slower than today on a low-end Android; the seven font files (1.03 MB) stay as they are |
| N2 | No unbounded list renders into a `ScrollView` (§3.7) |
| N3 | Frame rate stays at 60 fps while scrolling Contributions with 5 years of history on a budget device |
| N4 | The refresh adds no new npm dependency — everything specified here uses what is already installed |
| N5 | Phases 1–5 ship over the air; nothing in them touches `app.json` `plugins`, the icon or the splash |
| N6 | `npx tsc --noEmit` green at every commit; typed routes unchanged |
| N7 | React Compiler stays enabled; new components obey the rules of React |

---

## 7. Delivery

Six phases. **Each one is independently shippable** — this matters because there is no test
suite to catch a half-finished refresh (§10).

| Phase | Scope | Ships | Exit criteria |
|---|---|---|---|
| **0 · This document** | Approval of the direction | — | Owner signs off §1.2 |
| **1 · Motion** ✅ **done** | `src/motion.ts`; every call site in `pressable.tsx`, `TabBar.tsx`, `toast.tsx`, `(tabs)/index.tsx`, `(auth)/index.tsx`, `puruka/[id].tsx`, `Screen`, `Skeleton`, `ProgressBar`, `PhotoViewer`, `_layout.tsx`; explicit reduced motion; `scripts/check-motion.mjs` wired into CI | OTA | ✅ No spring remains outside `SPRING.settle` (ζ = 1.00); the gate fails on the original bug when reintroduced; `tsc` green; bundle exports and runs with no runtime errors. **Outstanding: the owner confirms on a `preview` build that nothing dances** |
| **2 · Sinhala and type** | `useType()` everywhere; delete 27 `fontWeight`s; six-size scale; tab labels; font scaling | OTA | No `fontWeight` outside `typography.tsx`; Sinhala headings bold on a real Android; 200 % font scale clean |
| **3 · Colour** | Web brand scale, AA-passing semantics, dark-mode primary and gradient, membership-card badge | OTA | Contrast script passes in both themes |
| **4 · Components** | `ListRow`, `StatusPill`, `Chip`, `AmountCard`; `Input`/`Card`/`Screen`/`Segmented` rework; retire duplicates | OTA | Duplicate implementations deleted, not merely unused |
| **5 · Screens** | Home, Dues, Contributions, Loans, Notices; `FlatList`; Welcome reachable | OTA | Before/after screenshots in four states (§8) |
| **6 · Binary (deferred)** | Unify the three blues; icon, splash, adaptive icon, notification colour; new Play Store screenshots; versionCode 7 | Store | Owner schedules it |

Sequencing rationale: motion first because it is the loudest complaint and the smallest
diff; Sinhala second because it affects the majority of users; colour third because it is
self-contained; components before screens because screens consume them.

---

## 8. Verification

CI runs only `npx tsc --noEmit`. There are no tests, no lint config and no visual
regression, so verification has to be deliberate and mostly scripted.

**Automated, added by this work** (`mobile/scripts/`, wired into `clients.yml`). `check-motion.mjs` exists and runs in CI as of phase 1; the other three arrive with their phases:

| Check | Fails when |
|---|---|
| `check-motion.mjs` | Any `withSpring` config omits `mass`, any `.springify()` has no argument, any computed ζ < 0.9, any duration > 400 ms outside the allow-list |
| `check-contrast.mjs` | Any palette text pair < 4.5:1, any control boundary or state indicator < 3:1, in either theme |
| `check-type.mjs` | Any `fontWeight` outside `src/typography.tsx`, any `fontSize` not on the six-step scale, any `Text` without a line height |
| `check-i18n.mjs` | `en.ts` / `si.ts` key parity broken, or a `t('…')` key missing from both |

These are the same arithmetic used to produce §2.1 and §2.3, so the document and the gate
cannot drift apart.

**By hand, on a real Android device** — the matrix is four states, and Sinhala is checked
first:

|  | Light | Dark |
|---|---|---|
| **Sinhala** (default) | ✔ every screen | ✔ every screen |
| **English** | ✔ every screen | ✔ every screen |

Plus: OS font size at maximum; OS reduce-motion on; a 360 dp phone (the narrowest common
Sri Lankan Android); and a screenshot set of Home, Dues, Contributions, Loans and Notices
before and after, attached to this document as an appendix.

**By the owner:** a `preview`-channel EAS build, opened and used. The acceptance question is
his own — *does it still dance?*

---

## 9. Open decisions

| # | Decision | Default if not answered |
|---|---|---|
| **O1** | The three long Sinhala tab labels (`මුල් පිටුව`, `දායක මුදල්`, `දැනුම්දීම්`) must shorten to fit ~60 dp. **A Sinhala speaker must choose the words** — this is not a developer's call | Phase 2 ships with the labels unchanged and allowed two lines, which is worse-looking but not wrong |
| **O2** | Should the Home "Status" block show the exact amount owed, or only a state? Showing money on the first screen is a privacy consideration in a shared household | Show the amount; it is the question the app exists to answer |
| **O3** | Phase 6 timing — the icon, splash and notification blue are visibly a different blue from the app until it ships | Bundle it with the next feature release rather than a release of its own |
| **O4** | Whether to keep the gradient at all. It is used in 7 places and is the app's only decorative device; a flatter treatment would be more "banking app" and less distinctive | Keep it, with the dark-mode variant from §3.4 |

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| **No safety net.** No tests, no visual regression. A sweep across 14 files can break a screen silently | Phase the work; ship each phase separately; before/after screenshots in four states; the four scripted gates in §8 |
| **Android has bitten this codebase three times** — SVG gradients swallowing touches, `elevation` smudging large radii, Sinhala bold falling back to the system face | §2.6 records all three; the gates in §8 catch the third mechanically; the first two are code-review rules |
| **Raising the type floor fits less per screen** | Intended (D3), but check on a 360 dp phone before phase 5 lands |
| **`ListRow` is used on every screen** — a bug in it is a bug everywhere | Land it in phase 4 on its own, ship, then migrate screens in phase 5 |
| **OTA means a bad release reaches every member within a day** | Each phase goes to the `preview` channel first and is opened by the owner before the `prod` channel |
| **Sinhala judgement cannot be made by the implementer** | O1 is explicitly the owner's |

---

## Appendix A · Files this work touches

**New:** `src/motion.ts` · `src/ui/ListRow.tsx` · `src/ui/StatusPill.tsx` · `src/ui/Chip.tsx` ·
`src/ui/AmountCard.tsx` · `scripts/check-motion.mjs` · `scripts/check-contrast.mjs` ·
`scripts/check-type.mjs` · `scripts/check-i18n.mjs`

**Reworked:** `src/theme.tsx` (palette, radius) · `src/typography.tsx` (scaled line height) ·
`src/ui/index.tsx` (Card, Input, Screen, Segmented, Skeleton, ProgressBar, Money, SectionHeader) ·
`src/ui/pressable.tsx` · `src/ui/TabBar.tsx` · `src/ui/toast.tsx` · `src/ui/MembershipCard.tsx`

**Screens re-composed:** `src/app/(tabs)/index.tsx` · `src/app/dues.tsx` ·
`src/app/(tabs)/contributions.tsx` · `src/app/(tabs)/loans.tsx` · `src/app/loan/[id].tsx` ·
`src/app/(tabs)/notices.tsx` · `src/app/(auth)/index.tsx` · `src/app/puruka-new.tsx`

**Token/type sweep only** (no layout change): the remaining 20 screen files, principally the
13 listed in §2.2.

**Deferred to phase 6:** `app.json` (adaptive icon `#1E6FD0`, notification colour, splash) ·
`assets/images/*` · `store-assets/*`

## Appendix B · Reference

| Thing | Where |
|---|---|
| What the app does | `docs/MEMBER-MOBILE-APP-REQUIREMENTS.md` |
| The shared design system | `docs/ESAMITHI-WEB-APP-REQUIREMENTS.md` §4 |
| Expo version pin | `https://docs.expo.dev/versions/v57.0.0/` — `mobile/AGENTS.md` requires reading the versioned docs before writing code |
| Reanimated spring defaults | `node_modules/react-native-reanimated/src/animation/spring/springConfigs.ts` |
| Build profiles | `mobile/eas.json` — `preview` (testbed channel) and `production` (prod channel) |
| Regenerate this document's PDF | `node docs/build-pdf.mjs ESAMITHI-MOBILE-UIUX-REQUIREMENTS` |
