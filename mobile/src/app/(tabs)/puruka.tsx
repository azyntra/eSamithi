import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { photoUrl } from '../../api/client'
import {
  usePurukaCategories,
  usePurukaFeed,
  type PurukaFilters,
  type PurukaPost,
  type PurukaType
} from '../../api/hooks'
import { BottomSheet, Button, Chip, EmptyState, ErrorView, Fab, ListScreen, PageTitle, ScalePressable, Screen, Segmented, SegmentedTabs, SkeletonCards, StaleBanner, useCardStyle } from '../../ui'
import { formatCurrency } from '../../lib/money'
import { dur, useReducedMotion } from '../../motion'

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
  const reduce = useReducedMotion()
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const catLabel = lang === 'si' ? post.category_si : post.category_en
  const wanted = post.type === 'wanted'
  const sold = post.status === 'Sold'
  return (
    <ScalePressable onPress={onPress} accessibilityRole="button" scaleTo={0.97} style={[card, { flex: 1, overflow: 'hidden' }]}>
      <View style={{ aspectRatio: 4 / 3, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        {post.photos.length > 0 ? (
          <Image
            source={{ uri: photoUrl(post.photos[0]) }}
            style={{ width: '100%', height: '100%', opacity: sold ? 0.55 : 1 }}
            contentFit="cover"
            transition={reduce ? 0 : dur.gesture}
            recyclingKey={String(post.id)}
          />
        ) : (
          <Ionicons name={categoryIcon(post.category_code)} size={36} color={p.textSubtle} />
        )}
        {sold || wanted ? (
          <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: p.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 2 }}>
            <Text style={{ color: sold ? p.textMuted : p.primaryOnSoft, fontSize: typeScale.micro, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.micro) }}>
              {sold ? (wanted ? t('mob.pkFound') : t('mob.pkSold')) : t('mob.pkWanted')}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: spacing.md }}>
        <Text numberOfLines={2} style={{ color: p.text, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), minHeight: ty.lh(typeScale.caption) * 2 }}>{post.title}</Text>
        {post.price !== null ? (
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: p.text, fontSize: typeScale.body, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'], marginTop: spacing.xs }}>{formatCurrency(post.price)}</Text>
        ) : (
          <Text numberOfLines={1} style={{ color: p.primaryOnSoft, fontSize: typeScale.caption, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.xs }}>{wanted ? t('mob.pkOpenBudget') : t('mob.pkNegotiable')}</Text>
        )}
        <Text numberOfLines={1} style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro), marginTop: 2 }}>
          {[catLabel, post.location].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </ScalePressable>
  )
}

// Puruka feed (redesign §6.5.1): title, search, one Filters sheet instead of an
// inline panel, a two-column grid that loads more as you scroll, and a
// floating New post button.
export default function Puruka(): React.ReactElement {
  const { t, lang } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const categories = usePurukaCategories()

  const [category, setCategory] = useState<number | 'all'>('all')
  const [type, setType] = useState<'all' | PurukaType>('all')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState(false)
  // Draft values inside the sheet; applied together with "Show results"
  const [location, setLocation] = useState('')
  const [minStr, setMinStr] = useState('')
  const [maxStr, setMaxStr] = useState('')
  const [avail, setAvail] = useState<PurukaFilters['avail']>('all')
  const [applied, setApplied] = useState({ location: '', minStr: '', maxStr: '', avail: 'all' as PurukaFilters['avail'] })

  const rupees = (v: string): number | null => {
    const n = parseFloat(v)
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
  }
  const filters: PurukaFilters = {
    category,
    type,
    q,
    location: applied.location,
    minPrice: rupees(applied.minStr),
    maxPrice: rupees(applied.maxStr),
    avail: applied.avail
  }
  const activeFilters = [applied.location.trim() !== '', rupees(applied.minStr) !== null, rupees(applied.maxStr) !== null, applied.avail !== 'all'].filter(Boolean).length

  const feed = usePurukaFeed(filters)
  const items = feed.data?.pages.flatMap((page) => page.items) ?? []
  // Two tiles per list row, so the grid still virtualises
  const rows = useMemo(() => {
    const out: PurukaPost[][] = []
    for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2))
    return out
  }, [items])

  const openPost = (post: PurukaPost): void => router.push({ pathname: '/puruka/[id]', params: { id: String(post.id) } })

  const inputStyle = { backgroundColor: p.surfaceAlt, borderColor: p.borderStrong, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 48, fontSize: typeScale.body, fontFamily: ty.family.regular, color: p.text }

  const header = (
    <View>
      <PageTitle title={t('mob.tabPuruka')} subtitle={t('mob.pkTagline')} />
      {feed.isError && feed.data ? <StaleBanner /> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, borderColor: p.borderStrong, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 48 }}>
          <Ionicons name="search-outline" size={20} color={p.textMuted} />
          <TextInput
            style={{ flex: 1, paddingHorizontal: spacing.sm, fontSize: typeScale.body, fontFamily: ty.family.regular, color: p.text }}
            placeholder={t('mob.pkSearch')}
            placeholderTextColor={p.textSubtle}
            accessibilityLabel={t('mob.pkSearch')}
            value={searchInput}
            onChangeText={(v) => {
              setSearchInput(v)
              if (v === '') setQ('')
            }}
            onSubmitEditing={() => setQ(searchInput)}
            returnKeyType="search"
          />
          {q !== '' ? (
            <Pressable onPress={() => { setSearchInput(''); setQ('') }} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ padding: spacing.xs }}>
              <Ionicons name="close-circle" size={20} color={p.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <ScalePressable
          onPress={() => setSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={t('mob.pkFilters')}
          haptic="selection"
          style={{ width: 48, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: activeFilters > 0 ? p.primary : p.borderStrong, backgroundColor: activeFilters > 0 ? p.primarySoft : p.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="options-outline" size={22} color={activeFilters > 0 ? p.primaryOnSoft : p.text} />
          {activeFilters > 0 ? (
            <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: p.bg }}>
              <Text style={{ color: p.onPrimary, fontSize: typeScale.micro, fontFamily: interFamily.bold }}>{activeFilters}</Text>
            </View>
          ) : null}
        </ScalePressable>
      </View>
      <SegmentedTabs<'all' | PurukaType>
        options={[
          { value: 'all', label: t('mob.pkAll') },
          { value: 'sell', label: t('mob.pkTypeSell') },
          { value: 'wanted', label: t('mob.pkTypeWanted') }
        ]}
        value={type}
        onChange={setType}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.md }} contentContainerStyle={{ gap: spacing.sm }}>
        {[{ id: 'all' as const, label: t('mob.pkAll'), code: '' },
          ...(categories.data ?? []).map((c) => ({ id: c.id, label: lang === 'si' ? c.label_si : c.label_en, code: c.code }))
        ].map((chip) => (
          <Chip key={String(chip.id)} label={chip.label} icon={chip.code ? categoryIcon(chip.code) : undefined} selected={category === chip.id} onPress={() => setCategory(chip.id)} />
        ))}
      </ScrollView>
    </View>
  )

  const body = feed.isPending ? (
    <Screen><PageTitle title={t('mob.tabPuruka')} subtitle={t('mob.pkTagline')} /><SkeletonCards cards={4} /></Screen>
  ) : feed.isError && !feed.data ? (
    <Screen refreshing={feed.isRefetching} onRefresh={() => feed.refetch()}><PageTitle title={t('mob.tabPuruka')} /><ErrorView onRetry={() => feed.refetch()} /></Screen>
  ) : (
    <ListScreen<PurukaPost[]>
      data={rows}
      keyExtractor={(row) => String(row[0]?.id)}
      renderItem={(row) => (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          {row.map((post) => <PostTile key={post.id} post={post} onPress={() => openPost(post)} />)}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      )}
      header={header}
      empty={<EmptyState icon="storefront-outline" text={t('mob.pkEmpty')} />}
      footer={feed.isFetchingNextPage ? <ActivityIndicator color={p.primary} style={{ marginVertical: spacing.lg }} /> : <View style={{ height: spacing.huge + spacing.xl }} />}
      refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      onRefresh={() => feed.refetch()}
      onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage() }}
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {body}
      <Fab icon="add" label={t('mob.pkFab')} onPress={() => router.push('/puruka-new')} />
      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={t('mob.pkFilters')}
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button label={t('mob.pkShowResults')} onPress={() => { setApplied({ location, minStr, maxStr, avail }); setSheet(false) }} />
            <Button
              label={t('mob.pkClearFilters')}
              variant="secondary"
              onPress={() => {
                setLocation(''); setMinStr(''); setMaxStr(''); setAvail('all')
                setApplied({ location: '', minStr: '', maxStr: '', avail: 'all' })
                setSheet(false)
              }}
            />
          </View>
        }
      >
        <Text style={{ color: p.text, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginBottom: spacing.sm }}>{t('mob.pkAvailability')}</Text>
        <Segmented<PurukaFilters['avail']>
          options={[
            { value: 'all', label: t('mob.pkAll') },
            { value: 'available', label: t('mob.pkAvailable') },
            { value: 'sold', label: t('mob.pkSold') }
          ]}
          value={avail}
          onChange={setAvail}
        />
        <Text style={{ color: p.text, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('mob.pkPriceRange')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput style={[inputStyle, { flex: 1 }]} placeholder={t('mob.pkMinPrice')} placeholderTextColor={p.textSubtle} keyboardType="decimal-pad" value={minStr} onChangeText={setMinStr} accessibilityLabel={t('mob.pkMinPrice')} />
          <TextInput style={[inputStyle, { flex: 1 }]} placeholder={t('mob.pkMaxPrice')} placeholderTextColor={p.textSubtle} keyboardType="decimal-pad" value={maxStr} onChangeText={setMaxStr} accessibilityLabel={t('mob.pkMaxPrice')} />
        </View>
        <Text style={{ color: p.text, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('mob.pkLocationFilter')}</Text>
        <TextInput style={inputStyle} placeholder={t('mob.pkLocationFilter')} placeholderTextColor={p.textSubtle} value={location} onChangeText={setLocation} accessibilityLabel={t('mob.pkLocationFilter')} />
      </BottomSheet>
    </View>
  )
}
