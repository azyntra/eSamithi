import React, { useState } from 'react'
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { usePalette, type Palette } from '../../theme'
import { photoUrl } from '../../api/client'
import {
  usePurukaCategories,
  usePurukaFeed,
  type PurukaFilters,
  type PurukaPost
} from '../../api/hooks'
import { Badge, Button, EmptyState, ErrorView, Money, Screen, Segmented, SkeletonCards, StaleBanner } from '../../ui'

type TFunc = ReturnType<typeof useT>['t']

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

function PostTile({ post, lang, p, t, onPress }: {
  post: PurukaPost
  lang: 'en' | 'si'
  p: Palette
  t: TFunc
  onPress: () => void
}): React.ReactElement {
  const catLabel = lang === 'si' ? post.category_si : post.category_en
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ width: '48%', backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}
    >
      <View style={{ height: 130, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        {post.photos.length > 0 ? (
          <Image source={{ uri: photoUrl(post.photos[0]) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name={categoryIcon(post.category_code)} size={40} color={p.border} />
        )}
        {post.status === 'Sold' && (
          <View style={{ position: 'absolute', top: 8, left: 8 }}>
            <Badge text={t('mob.pkSold')} color="#fff" bg={p.danger} />
          </View>
        )}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{post.title}</Text>
        <View style={{ marginTop: 3 }}>
          {post.price !== null
            ? <Money cents={post.price} size={14} bold color={p.primary} />
            : <Text style={{ color: p.primary, fontSize: 13, fontWeight: '700' }}>{t('mob.pkNegotiable')}</Text>}
        </View>
        <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
          {catLabel}{post.location ? ` · ${post.location}` : ''}
        </Text>
        {!!post.seller_name && (
          <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {post.seller_name}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

export default function Puruka(): React.ReactElement {
  const { t, lang } = useT()
  const p = usePalette()
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
      <Text style={{ color: p.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>
        {t('mob.pkTagline')}
      </Text>

      {/* Search + filters toggle + new post */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }}>
          <Ionicons name="search-outline" size={18} color={p.textMuted} />
          <TextInput
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 15, color: p.text }}
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
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          accessibilityRole="button"
          style={{ backgroundColor: showFilters ? p.primary : p.surface, borderColor: showFilters ? p.primary : p.border, borderWidth: 1, borderRadius: 12, width: 46, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="options-outline" size={20} color={showFilters ? p.onPrimary : p.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/puruka-new')}
          accessibilityRole="button"
          style={{ backgroundColor: p.primary, borderRadius: 12, width: 46, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={26} color={p.onPrimary} />
        </Pressable>
      </View>

      {/* Extra filters: availability, price range, location */}
      {showFilters && (
        <View style={{ backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, gap: 10 }}>
          <Segmented<PurukaFilters['avail']>
            options={[
              { value: 'all', label: t('mob.pkAll') },
              { value: 'available', label: t('mob.pkAvailable') },
              { value: 'sold', label: t('mob.pkSold') }
            ]}
            value={avail}
            onChange={setAvail}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: p.text }}
              placeholder={t('mob.pkMinPrice')}
              placeholderTextColor={p.textMuted}
              keyboardType="decimal-pad"
              value={minStr}
              onChangeText={setMinStr}
            />
            <TextInput
              style={{ flex: 1, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: p.text }}
              placeholder={t('mob.pkMaxPrice')}
              placeholderTextColor={p.textMuted}
              keyboardType="decimal-pad"
              value={maxStr}
              onChangeText={setMaxStr}
            />
          </View>
          <TextInput
            style={{ backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: p.text }}
            placeholder={t('mob.pkLocationFilter')}
            placeholderTextColor={p.textMuted}
            value={location}
            onChangeText={setLocation}
          />
        </View>
      )}

      {/* Category chips (from the server — admin-manageable) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
        {[{ id: 'all' as const, label: t('mob.pkAll'), code: '' },
          ...(categories.data ?? []).map((c) => ({ id: c.id, label: lang === 'si' ? c.label_si : c.label_en, code: c.code }))
        ].map((chip) => (
          <Pressable
            key={String(chip.id)}
            onPress={() => setCategory(chip.id)}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 18,
              backgroundColor: category === chip.id ? p.primary : p.surface,
              borderWidth: 1,
              borderColor: category === chip.id ? p.primary : p.border
            }}
          >
            <Text style={{ color: category === chip.id ? p.onPrimary : p.textMuted, fontSize: 13, fontWeight: '700' }}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
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
                lang={lang}
                p={p}
                t={t}
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
