import { requireOptionalNativeModule } from 'expo'

// Recording and listening need the expo-audio native module, which arrives
// with the 1.7.0 Play build (docs/MEETING-MINUTES-REQUIREMENTS.md §11, M5).
// One JS bundle serves both binaries: on 1.6.1 this is false and the screens
// show how to get the update instead of a broken player.
let cached: boolean | null = null

export function hasAudioPlayback(): boolean {
  if (cached === null) {
    try {
      cached = requireOptionalNativeModule('ExpoAudio') !== null
    } catch {
      cached = false
    }
  }
  return cached
}
