import React, { useEffect } from 'react'
import { View } from 'react-native'
import { usePathname, useRouter, type ErrorBoundaryProps } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { spacing, usePalette } from '../theme'
import { reportError } from '../lib/errorReporter'
import { Button } from './index'
import { MText } from './minutes'

// expo-router renders this in place of a screen whose render threw. Without
// it a render error unmounts the whole app and Android shows only the empty
// window (a plain grey screen). The error is reported with the screen's path
// so it can be found in client_errors, and the member gets Try again / Back.
// The theme and language contexts have safe defaults, so this still renders
// if it is used above their providers.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const path = usePathname()

  useEffect(() => {
    reportError(error, true, `render ${path}`)
  }, [error, path])

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <Ionicons name="alert-circle-outline" size={48} color={p.danger} />
      <MText size="heading" weight="bold" style={{ textAlign: 'center' }}>{t('mob.crashTitle')}</MText>
      <MText color={p.textMuted} style={{ textAlign: 'center' }}>{t('mob.crashBody')}</MText>
      <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md }}>
        <Button label={t('mob.retry')} icon="refresh" onPress={() => void retry()} />
        {router.canGoBack() ? <Button label={t('mob.crashBack')} variant="secondary" onPress={() => router.back()} /> : null}
      </View>
    </View>
  )
}
