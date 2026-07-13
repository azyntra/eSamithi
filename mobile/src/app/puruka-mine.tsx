import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { photoUrl } from '../api/client'
import { useMyPurukaPosts, useUpdatePurukaPost, type PurukaPost } from '../api/hooks'
import { categoryIcon } from './(tabs)/puruka'
import { Badge, Banner, Button, EmptyState, ErrorView, Money, Screen, SkeletonCards, StaleBanner } from '../ui'

const EXPIRY_WARN_DAYS = 3

function daysUntil(dateStr: string): number {
  const target = new Date(String(dateStr).split('T')[0] + 'T00:00:00')
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}

export default function MyPurukaPosts(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const posts = useMyPurukaPosts()
  const update = useUpdatePurukaPost()

  if (posts.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (posts.isError && !posts.data) {
    return (
      <Screen refreshing={posts.isRefetching} onRefresh={() => posts.refetch()}>
        <ErrorView onRetry={() => posts.refetch()} />
      </Screen>
    )
  }

  const rows = posts.data!
  const expiringSoon = rows.filter(
    (post) => post.status === 'Active' && post.expires_at && daysUntil(post.expires_at) <= EXPIRY_WARN_DAYS
  )

  const statusBadge = (post: PurukaPost): React.ReactElement => {
    const map: Record<PurukaPost['status'], { text: string; color: string; bg: string }> = {
      Active: { text: t('common.active'), color: p.success, bg: p.successBg },
      Sold: { text: t('mob.pkSold'), color: p.textMuted, bg: p.surfaceAlt },
      Inactive: { text: t('mob.pkInactive'), color: p.warning, bg: p.warningBg },
      Removed: { text: t('mob.pkRemoved'), color: p.danger, bg: p.dangerBg },
      Deleted: { text: t('mob.pkRemoved'), color: p.danger, bg: p.dangerBg }
    }
    const c = map[post.status]
    return <Badge text={c.text} color={c.color} bg={c.bg} />
  }

  return (
    <Screen refreshing={posts.isRefetching} onRefresh={() => posts.refetch()}>
      {posts.isError && <StaleBanner />}

      {expiringSoon.length > 0 && (
        <Banner kind="warning" text={t('mob.pkExpiringSoon', { count: expiringSoon.length })} />
      )}

      <Button label={t('mob.pkSell')} onPress={() => router.push('/puruka-new')} />
      <View style={{ height: 14 }} />

      {rows.length === 0 ? (
        <EmptyState icon="pricetags-outline" text={t('mob.pkNoMine')} />
      ) : (
        rows.map((post) => {
          const expiring = post.status === 'Active' && post.expires_at && daysUntil(post.expires_at) <= EXPIRY_WARN_DAYS
          return (
            <Pressable
              key={post.id}
              onPress={() => router.push({ pathname: '/puruka/[id]', params: { id: String(post.id) } })}
              accessibilityRole="button"
              style={{
                backgroundColor: p.surface,
                borderColor: expiring ? p.warning : p.border,
                borderWidth: 1,
                borderRadius: 14,
                overflow: 'hidden',
                marginBottom: 12
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 92, height: 92, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  {post.photos.length > 0 ? (
                    <Image source={{ uri: photoUrl(post.photos[0]) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Ionicons name={categoryIcon(post.category_code)} size={30} color={p.border} />
                  )}
                </View>
                <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>{post.title}</Text>
                    {statusBadge(post)}
                  </View>
                  <View style={{ marginTop: 4 }}>
                    {post.price !== null
                      ? <Money cents={post.price} size={14} bold color={p.primary} />
                      : <Text style={{ color: p.primary, fontSize: 13, fontWeight: '700' }}>{t('mob.pkNegotiable')}</Text>}
                  </View>
                  {!!post.expires_at && post.status === 'Active' && (
                    <Text style={{ color: expiring ? p.warning : p.textMuted, fontSize: 12, marginTop: 3, fontWeight: expiring ? '700' : '400' }}>
                      {t('mob.pkExpires')}: {String(post.expires_at).split('T')[0]}
                    </Text>
                  )}
                </View>
                <View style={{ justifyContent: 'center', paddingRight: 10 }}>
                  <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
                </View>
              </View>
              {(expiring || post.status === 'Inactive') && (
                <Pressable
                  onPress={() => update.mutate({ id: post.id, data: { action: 'renew' } })}
                  accessibilityRole="button"
                  style={{ backgroundColor: p.warningBg, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                >
                  <Ionicons name="refresh-outline" size={15} color={p.warning} />
                  <Text style={{ color: p.warning, fontSize: 13, fontWeight: '700' }}>{t('mob.pkRenew')}</Text>
                </Pressable>
              )}
            </Pressable>
          )
        })
      )}
    </Screen>
  )
}
