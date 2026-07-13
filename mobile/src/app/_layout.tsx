import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider, useT } from '../i18n'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { ThemeProvider, usePalette, useThemeMode } from '../theme'
import { LoadingView } from '../ui'
import '../lib/queryFocus' // wires app-foreground → React Query refetch

const queryClient = new QueryClient({
  defaultOptions: {
    // Refetch when the app returns to the foreground or the network reconnects,
    // so members see desktop-side changes without a manual pull-to-refresh.
    queries: { retry: 1, refetchOnWindowFocus: true, refetchOnReconnect: true }
  }
})

function RootNavigator(): React.ReactElement {
  const { status } = useAuth()
  const { t } = useT()
  const p = usePalette()
  const { scheme } = useThemeMode()

  // Cold start: still exchanging the stored refresh token
  if (status === 'loading') return <LoadingView />

  return (
    <>
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: p.surface },
        headerTintColor: p.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: p.bg }
      }}
    >
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="loan/[id]" options={{ title: t('nav.loans') }} />
        <Stack.Screen name="profile" options={{ title: t('mob.myProfile') }} />
        <Stack.Screen name="benefits" options={{ title: t('mob.benefits') }} />
        <Stack.Screen name="payouts" options={{ title: t('mob.payouts') }} />
        <Stack.Screen name="guarantees" options={{ title: t('mob.guarantees') }} />
        <Stack.Screen name="society" options={{ title: t('mob.societyInfo') }} />
        <Stack.Screen name="help" options={{ title: t('mob.help') }} />
        <Stack.Screen name="card" options={{ title: t('mob.memberCard') }} />
        <Stack.Screen name="dues" options={{ title: t('mob.duesDetail') }} />
        <Stack.Screen name="requests" options={{ title: t('mob.requests') }} />
        <Stack.Screen name="new-request" options={{ title: t('mob.newRequest') }} />
        <Stack.Screen name="puruka/[id]" options={{ title: t('mob.tabPuruka') }} />
        <Stack.Screen name="puruka-new" options={{ title: t('mob.pkNewPost') }} />
        <Stack.Screen name="puruka-mine" options={{ title: t('mob.pkMyPosts') }} />
        <Stack.Screen name="society-funds" options={{ title: t('mob.fundsTitle') }} />
      </Stack.Protected>
      <Stack.Protected guard={status !== 'signedIn'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
    </>
  )
}

export default function RootLayout(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
