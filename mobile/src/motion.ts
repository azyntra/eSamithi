import { Easing, ReduceMotion, useReducedMotion, type EasingFunction } from 'react-native-reanimated'

// The single source of motion in this app.
//
// Why this file exists. Reanimated 4 changed the `withSpring` default from
// {damping:10, mass:1, stiffness:100} to GentleSpringConfig
// {damping:120, mass:4, stiffness:900}. That default is critically damped —
// damping ratio exactly 1.000, no overshoot. But a PARTIAL config is shallow-
// merged over it, so writing {damping:20, stiffness:400} leaves mass at 4 and
// drops the ratio to 0.25: 44% overshoot and 1.4 s of wobble on every tap.
// Ten `.damping(n)` calls across the app were each breaking a default that was
// already correct. That was the "dancing".
//
// Two rules follow, and both are enforced by scripts/check-motion.mjs:
//   1. Never pass a partial spring. State damping, stiffness AND mass, or
//      pass nothing at all and take the (correct) library default.
//   2. Never write a duration or an easing at a call site. Use these tokens.
//
// ratio = damping / (2 * sqrt(stiffness * mass)); 1.0 is critically damped.

// Bezier easings must be .factory()'d ONCE, here at module scope. Built per
// render they allocate a new worklet each time, and an un-factoried curve
// handed to a layout builder trips assertEasingIsWorklet in dev and misbehaves
// silently in release.
export const ease = {
  /** Things already on screen that move, resize or recolour. */
  standard: Easing.bezier(0.2, 0, 0, 1).factory(),
  /** Arrivals. Front-loaded, so keep the travel short (see dist.rise). */
  enter: Easing.bezier(0, 0, 0, 1).factory(),
  /** Departures. */
  exit: Easing.bezier(0.3, 0, 1, 1).factory(),
  /** Finger down. Reaches 75% of travel in the first 45 ms. */
  press: Easing.out(Easing.quad),
  /** The skeleton breath, and nothing else. The only curve allowed in a loop. */
  pulse: Easing.inOut(Easing.quad)
} as const

export const dur = {
  /** Finger down. Fast enough that even a 60 ms tap is acknowledged. */
  pressIn: 90,
  /** Finger up — the release settles rather than snapping. */
  pressOut: 140,
  /** Chips, tab pill, badge, pager dots, segmented selection. */
  micro: 150,
  /** Every exit. Deliberately shorter than its entrance. */
  exit: 160,
  /** Skeleton giving way to content. A seam-cover, not a performance. */
  content: 160,
  /** Toast, banner, dialog. */
  surface: 220,
  /** Auth screen elements arriving. */
  enter: 260,
  /** Progress fill. Also roughly the native stack transition, which we leave alone. */
  page: 320,
  /** Gesture settles and image cross-fades. Already correct; tokenised, not changed. */
  gesture: 180,
  /** Per item, first mount only, and only on the welcome screen. */
  stagger: 30
} as const

/** How far an entering element travels. Short, because ease.enter is front-loaded. */
export const dist = { rise: 12 } as const

/** withTiming config. Reduced motion is stated, not inherited by accident. */
export const timing = (
  duration: number,
  easing: EasingFunction = ease.standard
): { duration: number; easing: EasingFunction; reduceMotion: ReduceMotion } => ({
  duration,
  easing,
  reduceMotion: ReduceMotion.System
})

/**
 * The only spring in the app, stated in full so no future edit can half-
 * override it. These are Reanimated 4's own GentleSpring numbers:
 * 120 / (2 * sqrt(900 * 4)) = 1.000 — critically damped, ~390 ms, no overshoot.
 * Prefer a timing token; reach for this only when something must feel physical.
 */
export const SPRING = {
  settle: { damping: 120, stiffness: 900, mass: 4, reduceMotion: ReduceMotion.System }
} as const

/**
 * For the three things Reanimated cannot gate on its own: the PhotoViewer
 * Modal, the native stack transition and expo-image cross-fades. Reanimated's
 * own animations are already covered by ReduceMotion.System above.
 */
export { useReducedMotion }
