import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../../auth/AuthContext'
import { resolveSamithiCode, type ResolveErrorKind, type SamithiProfile } from '../../lib/profiles'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { Button, Card, Input, Subtitle, Title } from '../../ui'

// Samithi-code entry (multi-samithi): resolves the code via the directory
// service and hands the resulting profile to the rest of the (auth) flow.
export default function SamithiCode(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const { profiles, setPendingProfile } = useAuth()
  const insets = useSafeAreaInsets()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<SamithiProfile | null>(null)
  const [selected, setSelected] = useState<SamithiProfile | null>(null)

  // Navigate from an effect, AFTER the pending-profile context value has
  // committed. Calling router.replace in the same tick as the provider
  // setState raced the root re-render and the navigation was dropped on
  // release builds (Continue did nothing). Effect-driven navigation is the
  // pattern every other redirect in this app already uses.
  useEffect(() => {
    if (selected) router.replace('/(auth)')
  }, [selected, router])

  const submit = async (): Promise<void> => {
    setError('')
    if (!code.trim()) return
    setBusy(true)
    try {
      setFound(await resolveSamithiCode(code))
    } catch (err) {
      const kind = (err as { kind?: ResolveErrorKind }).kind
      setError(
        kind === 'unknown' ? t('mob.samithiUnknown')
        : kind === 'inactive' ? t('mob.samithiInactive')
        : t('mob.samithiNetErr')
      )
    } finally {
      setBusy(false)
    }
  }

  // Not "useProfile": a use-prefixed name makes the React Compiler treat
  // callback invocations of it as rule-of-hooks violations.
  const selectProfile = (profile: SamithiProfile): void => {
    setPendingProfile(profile)
    setSelected(profile)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Title>{t('mob.samithiTitle')}</Title>
        <Subtitle>{t('mob.samithiIntro')}</Subtitle>

        {found ? (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="checkmark-circle" size={28} color={p.success} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.textMuted, fontSize: 13 }}>{t('mob.samithiFound')}</Text>
                <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', marginTop: 2 }}>{found.name}</Text>
              </View>
            </Card>
            <View style={{ height: 16 }} />
            <Button label={t('mob.samithiContinue')} onPress={() => selectProfile(found)} />
            <View style={{ height: 10 }} />
            <Button
              label={t('mob.samithiChange')}
              variant="secondary"
              onPress={() => { setFound(null); setCode('') }}
            />
          </>
        ) : (
          <>
            <Input
              label={t('mob.samithiCode')}
              placeholder={t('mob.samithiCodePlaceholder')}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {error ? <Text style={{ color: p.danger, marginBottom: 12 }}>{error}</Text> : null}
            <Button label={busy ? t('mob.samithiChecking') : t('mob.samithiCheck')} onPress={submit} disabled={busy} />

            {profiles.length > 0 && (
              <>
                <Text style={{ color: p.textMuted, fontSize: 13, fontWeight: '700', marginTop: 28, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('mob.samithiExisting')}
                </Text>
                <Card style={{ paddingVertical: 4 }}>
                  {profiles.map((profile, i) => (
                    <Pressable
                      key={profile.slug}
                      accessibilityRole="button"
                      onPress={() => selectProfile(profile)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: p.border
                      }}
                    >
                      <Ionicons name="people-circle-outline" size={24} color={p.primary} style={{ marginRight: 12 }} />
                      <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', flex: 1 }}>
                        {profile.name || profile.code || profile.slug}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
                    </Pressable>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
