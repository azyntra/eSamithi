import { AppState, Platform, type AppStateStatus } from 'react-native'
import { focusManager } from '@tanstack/react-query'

// Bridge React Native's app lifecycle to React Query's focus tracking. Once
// this is imported, queries with `refetchOnWindowFocus` refetch whenever the
// user brings the app back to the foreground — and background polling
// (`refetchInterval`) pauses while the app is not active. Pure JS (AppState is
// core RN), so no native rebuild is needed.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (Platform.OS !== 'web') handleFocus(state === 'active')
  })
  return () => sub.remove()
})
