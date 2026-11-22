import React, { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { photoUrl } from '../api/client'
import { useMyPurukaPosts, useUpdatePurukaPost } from '../api/hooks'
import { formatDate } from '../lib/date'
import { categoryIcon } from './(tabs)/puruka'
import { Banner, Button, EmptyState, ErrorView, ScalePressable, Screen, SegmentedTabs, SkeletonCards, StaleBanner, StatusPill, useCardStyle } from '../ui'
import { formatCurrency } from '../lib/money'
import { interFamily, useType } from '../typography'

const EXPIRY_WARN_DAYS = 3

function daysUntil(dateStr: string): number {
  const target = new Date(String(dateStr).split('T')[0] + 'T00:00:00')
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}

type Seg = 'active' | 'sold' | 'expired'

// My posts (redesign §6.5.4): Active · Sold · Expired, with renew one tap away
export default function MyPurukaPosts(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const card = useCardStyle()
  const posts = useMyPurukaPosts()
  const update = useUpdatePurukaPost()
  const [seg, setSeg] = useState<Seg>('active')

  if (posts.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (posts.isError && !posts.data) {
    return (
      <Screen refreshing={posts.isRefetching} onRefresh={() => posts.refetch()}>
        <ErrorView onRetry={() => posts.refetch()} />
      </Screen>
    )
  }

  const all = posts.data!
  const inSeg = (status: string): Seg => (status === 'Active' ? 'active' : status === 'Sold' ? 'sold' : 'expired')
  const rows = all.filter((post) => inSeg(post.status) === seg)
  const expiringSoon = all.filter((post) => post.status === 'Active' && post.expires_at && daysUntil(post.expires_at) <= EXPIRY_WARN_DAYS)

  return (
    <Screen refreshing={posts.isRefetching} onRefresh={() => posts.refetch()}>
      {posts.isError && <StaleBanner />}
      {expiringSoon.length > 0 && <Banner kind="warning" text={t('mob.pkExpiringSoon', { count: expiringSoon.length })} />}

      <Button label={t('mob.pkSell')} icon="add" onPress={() => router.push('/puruka-new')} />
      <View style={{ height: spacing.md }} />
      <SegmentedTabs<Seg>
        options={[
          { value: 'active', label: t('mob.pkSegActive') },
          { value: 'sold', label: t('mob.pkSegSold') },
          { value: 'expired', label: t('mob.pkSegExpired') }
        ]}
        value={seg}
        onChange={setSeg}
      />
      <View style={{ height: spacing.md }} />

      {rows.length === 0 ? (
        <EmptyState icon="pricetags-outline" text={t('mob.pkNoMine')} />
      ) : (
        rows.map((post) => {
          const expiring = post.status === 'Active' && !!post.expires_at && daysUntil(post.expires_at) <= EXPIRY_WARN_DAYS
          const canRenew = expiring || post.status === 'Inactive'
          return (
            <View key={post.id} style={[card, { overflow: 'hidden', marginBottom: spacing.md, borderColor: expiring ? p.warning : p.border }]}>
              <ScalePressable
                onPress={() => router.push({ pathname: '/puruka/[id]', params: { id: String(post.id) } })}
                accessibilityRole="button"
                scaleTo={0.99}
                style={{ flexDirection: 'row' }}
              >
                <View style={{ width: 96, minHeight: 96, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  {post.photos.length > 0 ? (
                    <Image source={{ uri: photoUrl(post.photos[0]) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Ionicons name={categoryIcon(post.category_code)} size={30} color={p.textSubtle} />
                  )}
                </View>
                <View style={{ flex: 1, padding: spacing.md, justifyContent: 'center', gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text numberOfLines={1} style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{post.title}</Text>
                    <StatusPill status={post.status} />
                  </View>
                  {post.price !== null ? (
                    <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'] }}>{formatCurrency(post.price)}</Text>
                  ) : (
                    <Text style={{ color: p.primaryOnSoft, fontSize: typeScale.caption, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.pkNegotiable')}</Text>
                  )}
                  {post.expires_at && post.status === 'Active' ? (
                    <Text style={{ color: expiring ? p.warning : p.textMuted, fontSize: typeScale.micro, fontFamily: expiring ? ty.family.bold : ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>
                      {t('mob.pkExpires')}: {formatDate(post.expires_at)}
                    </Text>
                  ) : null}
                </View>
                <View style={{ justifyContent: 'center', paddingRight: spacing.sm + 2 }}>
                  <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
                </View>
              </ScalePressable>
              {canRenew ? (
                <Pressable
                  onPress={() => update.mutate({ id: post.id, data: { action: 'renew' } })}
                  accessibilityRole="button"
                  style={{ backgroundColor: p.warningBg, minHeight: 48, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}
                >
                  <Ionicons name="refresh-outline" size={18} color={p.warning} />
                  <Text style={{ color: p.warning, fontSize: typeScale.caption, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.pkRenew')}</Text>
                </Pressable>
              ) : null}
            </View>
          )
        })
      )}
    </Screen>
  )
}
