import React, { useState } from 'react'
import { Alert, Dimensions, Linking, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { LinearTransition } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { elevation, radius, spacing, usePalette } from '../../theme'
import { useType } from '../../typography'
import { photoUrl } from '../../api/client'
import { formatDate } from '../../lib/date'
import { useDeletePurukaPost, usePurukaPost, useReportPurukaPost, useUpdatePurukaPost } from '../../api/hooks'
import { categoryIcon } from '../(tabs)/puruka'
import { Badge, BrandGradient, Button, Card, ErrorView, Money, Row, ScalePressable, Screen, SectionHeader, SkeletonCards, StaleBanner, useToast } from '../../ui'
import { PhotoViewer } from '../../ui/PhotoViewer'

// "0771234567" → "94771234567" for wa.me; leaves already-international numbers alone
function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `94${digits.slice(1)}` : digits
}

export default function PurukaPostDetail(): React.ReactElement {
  const { t, lang } = useT()
  const p = usePalette()
  const ty = useType()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Number(params.id)

  const post = usePurukaPost(id)
  const update = useUpdatePurukaPost()
  const del = useDeletePurukaPost()
  const report = useReportPurukaPost()
  const toast = useToast()
  const [activePhoto, setActivePhoto] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)

  if (post.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (post.isError && !post.data) {
    return (
      <Screen refreshing={post.isRefetching} onRefresh={() => post.refetch()}>
        <ErrorView onRetry={() => post.refetch()} />
      </Screen>
    )
  }

  const item = post.data!
  const catLabel = lang === 'si' ? item.category_si : item.category_en
  const pageWidth = Dimensions.get('window').width - 32
  const phone = item.phone || ''
  // Sticky contact bar shows for other members' active posts with a phone
  const showContactBar = !item.is_owner && !!phone && item.status === 'Active'

  const statusBadge = (): React.ReactElement | null => {
    if (item.status === 'Sold') return <Badge text={t('mob.pkSold')} color="#fff" bg={p.danger} />
    if (item.status === 'Inactive') return <Badge text={t('mob.pkInactive')} color={p.warning} bg={p.warningBg} />
    if (item.status === 'Removed') return <Badge text={t('mob.pkRemoved')} color={p.danger} bg={p.dangerBg} />
    return null
  }

  const confirmDelete = (): void => {
    Alert.alert(t('mob.pkDelete'), t('mob.pkDeleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => del.mutate(id, { onSuccess: () => router.back() })
      }
    ])
  }

  const askReport = (): void => {
    const send = (reason: string): void =>
      report.mutate({ id, reason }, { onSuccess: () => toast.show('success', t('mob.pkReportThanks')) })
    Alert.alert(t('mob.pkReport'), t('mob.pkReportWhy'), [
      { text: t('mob.pkReportFake'), onPress: () => send('Not genuine') },
      { text: t('mob.pkReportSold'), onPress: () => send('Already sold') },
      { text: t('mob.pkReportBad'), onPress: () => send('Inappropriate') },
      { text: t('common.cancel'), style: 'cancel' }
    ])
  }

  const ownerAction = (action: 'sold' | 'available' | 'renew' | 'deactivate'): void => {
    update.mutate({ id, data: { action } }, { onSuccess: () => toast.show('success', t('mob.pkSaved')) })
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
    <Screen refreshing={post.isRefetching} onRefresh={() => post.refetch()}>
      {post.isError && <StaleBanner />}

      {/* Photos — horizontal pager with page-indicator dots */}
      {item.photos.length > 0 ? (
        <View style={{ marginBottom: spacing.lg - 2 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={pageWidth + 10}
            decelerationRate="fast"
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / (pageWidth + 10)))
            }
          >
            {item.photos.map((photo, i) => (
              <ScalePressable
                key={photo}
                accessibilityRole="imagebutton"
                scaleTo={0.99}
                onPress={() => { setActivePhoto(i); setViewerOpen(true) }}
              >
                <Image
                  source={{ uri: photoUrl(photo) }}
                  style={{ width: pageWidth, height: 250, borderRadius: radius.lg, marginRight: 10, backgroundColor: p.surfaceAlt }}
                  contentFit="cover"
                  transition={180}
                />
              </ScalePressable>
            ))}
          </ScrollView>
          {item.photos.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: spacing.md - 2 }}>
              {item.photos.map((photo, i) => (
                <Animated.View
                  key={photo}
                  layout={LinearTransition.springify().damping(18)}
                  style={{
                    width: i === activePhoto ? 20 : 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: i === activePhoto ? p.primary : p.border
                  }}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={{ height: 160, borderRadius: radius.lg, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg - 2 }}>
          <Ionicons name={categoryIcon(item.category_code)} size={54} color={p.border} />
        </View>
      )}

      {/* Title + status + price */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md - 2, marginBottom: spacing.xs }}>
        <Text style={{ color: p.text, fontSize: 22, fontFamily: ty.family.extrabold, lineHeight: ty.lh(22), flex: 1 }}>{item.title}</Text>
        {statusBadge()}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        {item.price !== null && <Money cents={item.price} size={20} bold color={p.primary} />}
        {item.negotiable === 1 && <Badge text={t('mob.pkNegotiable')} color={p.primary} bg={p.primarySoft} />}
      </View>

      {!!item.description && (
        <Text style={{ color: p.text, fontSize: 15, fontFamily: ty.family.regular, lineHeight: ty.lh(15), marginBottom: spacing.lg - 2 }}>{item.description}</Text>
      )}

      <Card style={{ paddingVertical: 6 }}>
        <Row label={t('mob.pkCategory')} value={catLabel} icon={categoryIcon(item.category_code)} />
        {!!item.location && <Row label={t('mob.pkLocation')} value={item.location} icon="location-outline" />}
        <Row label={t('mob.pkPosted')} value={formatDate(item.created_at)} icon="time-outline" />
        {item.is_owner && !!item.expires_at && item.status === 'Active' && (
          <Row label={t('mob.pkExpires')} value={formatDate(item.expires_at)} icon="hourglass-outline" />
        )}
      </Card>

      {/* Poster identity — the trust anchor of Puruka */}
      <SectionHeader>{t('mob.pkSeller')}</SectionHeader>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <BrandGradient rounded={radius.pill} />
          <Text style={{ color: p.onPrimary, fontSize: 18, fontFamily: ty.family.extrabold }}>
            {(item.seller_name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontFamily: ty.family.bold, lineHeight: ty.lh(16) }}>{item.seller_name}</Text>
          {!!item.seller_since && (
            <Text style={{ color: p.textMuted, fontSize: 13, fontFamily: ty.family.regular, lineHeight: ty.lh(13), marginTop: 2 }}>
              {t('mob.pkMemberSince', { year: String(item.seller_since).slice(0, 4) })}
            </Text>
          )}
        </View>
      </Card>

      {item.is_owner ? (
        <>
          {item.status === 'Active' && (
            <Button label={t('mob.pkMarkSold')} onPress={() => ownerAction('sold')} loading={update.isPending} />
          )}
          {item.status === 'Sold' && (
            <Button label={t('mob.pkMarkAvailable')} onPress={() => ownerAction('available')} loading={update.isPending} />
          )}
          {item.status === 'Inactive' && (
            <Button label={t('mob.pkRenew')} onPress={() => ownerAction('renew')} loading={update.isPending} />
          )}
          <Button
            label={t('mob.pkEdit')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/puruka-new', params: { id: String(id) } })}
          />
          {item.status === 'Active' && (
            <Button label={t('mob.pkDeactivate')} variant="secondary" onPress={() => ownerAction('deactivate')} />
          )}
          <Button label={t('mob.pkDelete')} variant="danger" onPress={confirmDelete} loading={del.isPending} />
        </>
      ) : (
        <>
          <Text
            onPress={askReport}
            style={{ color: p.textMuted, fontSize: 13, fontFamily: ty.family.regular, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: spacing.md - 2 }}
          >
            {t('mob.pkReport')}
          </Text>
          {/* Space so content scrolls clear of the sticky contact bar */}
          {showContactBar && <View style={{ height: 76 }} />}
        </>
      )}
    </Screen>

    <PhotoViewer
      photos={item.photos.map((ph) => photoUrl(ph))}
      initialIndex={activePhoto}
      visible={viewerOpen}
      onClose={() => setViewerOpen(false)}
    />

    {/* Sticky contact bar — call/WhatsApp always within thumb reach */}
    {showContactBar && (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          gap: spacing.sm + 2,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: p.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          shadowColor: p.shadow,
          ...elevation.md
        }}
      >
        <View style={{ flex: 1.6 }}>
          <Button label={t('mob.pkCall')} icon="call" onPress={() => Linking.openURL(`tel:${phone}`)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={() => Linking.openURL(`https://wa.me/${whatsappNumber(phone)}`)} />
        </View>
      </View>
    )}
    </View>
  )
}
