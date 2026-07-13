import React from 'react'
import { Stack } from 'expo-router'
import { usePalette } from '../../theme'

export default function AuthLayout(): React.ReactElement {
  const p = usePalette()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: p.bg },
        headerShadowVisible: false,
        headerTintColor: p.text,
        headerTitle: '',
        contentStyle: { backgroundColor: p.bg }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="samithi" options={{ headerShown: false }} />
    </Stack>
  )
}
