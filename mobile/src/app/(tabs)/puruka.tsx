import React, { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, usePalette, useThemeMode } from '../../theme'
import { useType } from '../../typography'
import { photoUrl } from '../../api/client'
import {
  usePurukaCategories,
  usePurukaFeed,
  type PurukaFilters,
  type PurukaPost
} from '../../api/hooks'
import { Badge, BrandGradient, Button, EmptyState, ErrorView, Money, ScalePressable, Screen, Segmented, SkeletonCards, StaleBanner } from '../../ui'

// Category code → icon; admin-added categories fall back to the tag icon
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  household: 'home-outline',
  tools: 'construct-outline',
  furniture: 'bed-outline',
  farming: 'leaf-outline',
  food: 'restaurant-outline',
  produce: 'nutrition-outline',
  services: 'hand-left-outline',
  rent: 'swap-horizontal-outline',
  other: 'pricetag-outline'
}

export function categoryIcon(code: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICONS[code] ?? 'pricetag-outline'
}

function PostTile({ post, onPress }: { post: PurukaPost; onPress: () => void }): React.ReactElement {
  const { t, lang } = useT()
  const p = usePalette()
  const ty = useType()
  const { scheme } = useThemeMode()
  const catLabel = lang === 'si' ? post.category_si : post.category_en
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole="button"
      scaleTo={0.97}
      style={{
        width: '48%',
        backgroundColor: scheme === 'dark' ? p.surface : p.surfaceElevated,
        borderRadius: radius.lg,
        overflow: 'hidden',
        marginBottom: spacing.md,
        // Hairline in both schemes — Android elevation smudges large radii
        borderWidth: 1,
        borderColor: p.border
      }}
    >
      <View style={{ height: 130, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        {post.photos.length > 0 ? (
          <Image
            source={{ uri: photoUrl(post.photos[0]) }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={180}
            recyclingKey={String(post.id)}
          />
        ) : (
          <Ionicons name={categoryIcon(post.category_code)} size={40} color={p.border} />
        )}
        {post.status === 'Sold' && (
          <View style={{ position: 'absolute', top: 8, left: 8 }}>
            <Badge text={t('mob.pkSold')} color="#fff" bg={p.danger} />
          </View>
        )}
      </View>
      <View style={{ padding: spacing.md - 2 }}>
        <Text style={{ color: p.text, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14) }} numberOfLines={1}>{post.title}</Text>
        <View style={{ marginTop: 3 }}>
          {post.price !== null
            ? <Money cents={post.price} size={14.5} bold color={p.primary} />
            : <Text style={{ color: p.primary, fontSize: 13, fontFamily: ty.family.bold, lineHeight: ty.lh(13) }}>{t('mob.pkNegotiable')}</Text>}
        </View>
        <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.regular, lineHeight: ty.lh(12), marginTop: 3 }} numberOfLines={1}>
          {catLabel}{post.location ? ` · ${post.location}` : ''}
        </Text>
        {!!post.seller_name && (
          <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.regular, lineHeight: ty.lh(12), marginTop: 2 }} numberOfLines={1}>
            {post.seller_name}
          </Text>
        )}
      </View>
    </ScalePressable>
  )
}

export default function Puruka(): React.ReactElement {
  const { t, lang } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()

  const categories = usePurukaCategories()

  const [category, setCategory] = useState<number | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [location, setLocation] = useState('')
  const [minStr, setMinStr] = useState('')
  const [maxStr, setMaxStr] = useState('')
  const [avail, setAvail] = useState<PurukaFilters['avail']>('all')

  const rupees = (s: string): number | null => {
    const v = parseFloat(s)
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null
  }
  const filters: PurukaFilters = {
    category,
    q,
    location: showFilters ? location : '',
    minPrice: showFilters ? rupees(minStr) : null,
    maxPrice: showFilters ? rupees(maxStr) : null,
    avail: showFilters ? avail : 'all'
  }

  const feed = usePurukaFeed(filters)
  const items = feed.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Screen refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => feed.refetch()}>
      {feed.isError && feed.data && <StaleBanner />}

      {/* Community tagline */}
      <Text style={{ color: p.textMuted, fontSize: 13, fontFamily: ty.family.semibold, lineHeight: ty.lh(13), marginBottom: spacing.md - 2 }}>
        {t('mob.pkTagline')}
      </Text>

      {/* Search + filters toggle + new post */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, borderColor: p.border, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
          <Ionicons name="search-outline" size={18} color={p.textMuted} />
          <TextInput
            style={{ flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, fontSize: 15, fontFamily: ty.family.regular, color: p.text }}
            placeholder={t('mob.pkSearch')}
            placeholderTextColor={p.textMuted}
            value={searchInput}
            onChangeText={(v) => {
              setSearchInput(v)
              if (v === '') setQ('')
            }}
            onSubmitEditing={() => setQ(searchInput)}
            returnKeyType="search"
          />
          {q !== '' && (
            <Pressable onPress={() => { setSearchInput(''); setQ('') }} accessibilityRole="button">
              <Ionicons name="close-circle" size={18} color={p.textMuted} />
            </Pressable>
          )}
        </View>
        <ScalePressable
          onPress={() => setShowFilters((v) => !v)}
          accessibilityRole="button"
          haptic="selection"
          style={{ backgroundColor: showFilters ? p.primary : p.surface, borderColor: showFilters ? p.primary : p.border, borderWidth: 1.5, borderRadius: radius.md, width: 46, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="options-outline" size={20} color={showFilters ? p.onPrimary : p.textMuted} />
        </ScalePressable>
        <ScalePressable
          onPress={() => router.push('/puruka-new')}
          accessibilityRole="button"
          haptic="impact"
          style={{ borderRadius: radius.md, width: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <BrandGradient rounded={radius.md} />
          <Ionicons name="add" size={26} color={p.onPrimary} />
        </ScalePressable>
      </View>

      {/* Extra filters: availability, price range, location */}
      {showFilters && (
        <View style={{ backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.md - 2 }}>
          <Segmented<PurukaFilters['avail']>
            options={[
              { value: 'all', label: t('mob.pkAll') },
              { value: 'available', label: t('mob.pkAvailable') },
              { value: 'sold', label: t('mob.pkSold') }
            ]}
            value={avail}
            onChange={setAvail}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput
              style={{ flex: 1, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md - 2, paddingVertical: spacing.sm + 1, fontSize: 14, fontFamily: ty.family.regular, color: p.text }}
              placeholder={t('mob.pkMinPrice')}
              placeholderTextColor={p.textMuted}
              keyboardType="decimal-pad"
              value={minStr}
              onChangeText={setMinStr}
            />
            <TextInput
              style={{ flex: 1, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md - 2, paddingVertical: spacing.sm + 1, fontSize: 14, fontFamily: ty.family.regular, color: p.text }}
              placeholder={t('mob.pkMaxPrice')}
              placeholderTextColor={p.textMuted}
              keyboardType="decimal-pad"
              value={maxStr}
              onChangeText={setMaxStr}
            />
          </View>
          <TextInput
            style={{ backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md - 2, paddingVertical: spacing.sm + 1, fontSize: 14, fontFamily: ty.family.regular, color: p.text }}
            placeholder={t('mob.pkLocationFilter')}
            placeholderTextColor={p.textMuted}
            value={location}
            onChangeText={setLocation}
          />
        </View>
      )}

      {/* Category chips (from the server — admin-manageable) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg - 2 }} contentContainerStyle={{ gap: spacing.sm }}>
        {[{ id: 'all' as const, label: t('mob.pkAll'), code: '' },
          ...(categories.data ?? []).map((c) => ({ id: c.id, label: lang === 'si' ? c.label_si : c.label_en, code: c.code }))
        ].map((chip) => {
          const selected = category === chip.id
          return (
            <ScalePressable
              key={String(chip.id)}
              onPress={() => setCategory(chip.id)}
              accessibilityRole="button"
              accessibilityState={selected ? { selected: true } : {}}
              haptic="selection"
              scaleTo={0.94}
              style={{
                paddingHorizontal: spacing.lg - 2,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: selected ? p.primary : p.primarySoft
              }}
            >
              <Text style={{ color: selected ? p.onPrimary : p.primary, fontSize: 13, fontFamily: ty.family.bold, lineHeight: ty.lh(13) }}>
                {chip.label}
              </Text>
            </ScalePressable>
          )
        })}
      </ScrollView>

      {feed.isPending ? (
        <SkeletonCards cards={4} />
      ) : feed.isError && !feed.data ? (
        <ErrorView onRetry={() => feed.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="storefront-outline" text={t('mob.pkEmpty')} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {items.map((post) => (
              <PostTile
                key={post.id}
                post={post}
                onPress={() => router.push({ pathname: '/puruka/[id]', params: { id: String(post.id) } })}
              />
            ))}
          </View>
          {feed.hasNextPage && (
            <Button
              label={t('mob.pkLoadMore')}
              variant="secondary"
              loading={feed.isFetchingNextPage}
              onPress={() => feed.fetchNextPage()}
            />
          )}
        </>
      )}
    </Screen>
  )
}
