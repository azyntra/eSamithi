import React, { useState } from 'react'
import { Alert, Dimensions, Image, Linking, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { photoUrl } from '../../api/client'
import { useDeletePurukaPost, usePurukaPost, useReportPurukaPost, useUpdatePurukaPost } from '../../api/hooks'
import { categoryIcon } from '../(tabs)/puruka'
import { Badge, Button, Card, ErrorView, Money, Row, Screen, SectionHeader, SkeletonCards, StaleBanner } from '../../ui'

// "0771234567" → "94771234567" for wa.me; leaves already-international numbers alone
function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `94${digits.slice(1)}` : digits
}

export default function PurukaPostDetail(): React.ReactElement {
  const { t, lang } = useT()
  const p = usePalette()
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Number(params.id)

  const post = usePurukaPost(id)
  const update = useUpdatePurukaPost()
  const del = useDeletePurukaPost()
  const report = useReportPurukaPost()
  const [activePhoto, setActivePhoto] = useState(0)

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
      report.mutate({ id, reason }, { onSuccess: () => Alert.alert('', t('mob.pkReportThanks')) })
    Alert.alert(t('mob.pkReport'), t('mob.pkReportWhy'), [
      { text: t('mob.pkReportFake'), onPress: () => send('Not genuine') },
      { text: t('mob.pkReportSold'), onPress: () => send('Already sold') },
      { text: t('mob.pkReportBad'), onPress: () => send('Inappropriate') },
      { text: t('common.cancel'), style: 'cancel' }
    ])
  }

  return (
    <Screen refreshing={post.isRefetching} onRefresh={() => post.refetch()}>
      {post.isError && <StaleBanner />}

      {/* Photos — horizontal pager with page-indicator dots */}
      {item.photos.length > 0 ? (
        <View style={{ marginBottom: 14 }}>
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
            {item.photos.map((photo) => (
              <Image
                key={photo}
                source={{ uri: photoUrl(photo) }}
                style={{ width: pageWidth, height: 250, borderRadius: 14, marginRight: 10, backgroundColor: p.surfaceAlt }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {item.photos.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 10 }}>
              {item.photos.map((photo, i) => (
                <View
                  key={photo}
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
        <View style={{ height: 160, borderRadius: 14, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Ionicons name={categoryIcon(item.category_code)} size={54} color={p.border} />
        </View>
      )}

      {/* Title + status + price */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', flex: 1 }}>{item.title}</Text>
        {statusBadge()}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {item.price !== null && <Money cents={item.price} size={20} bold color={p.primary} />}
        {item.negotiable === 1 && <Badge text={t('mob.pkNegotiable')} color={p.primary} bg={p.surfaceAlt} />}
      </View>

      {!!item.description && (
        <Text style={{ color: p.text, fontSize: 15, lineHeight: 22, marginBottom: 14 }}>{item.description}</Text>
      )}

      <Card style={{ paddingVertical: 6 }}>
        <Row label={t('mob.pkCategory')} value={catLabel} />
        {!!item.location && <Row label={t('mob.pkLocation')} value={item.location} />}
        <Row label={t('mob.pkPosted')} value={String(item.created_at).split('T')[0]} />
        {item.is_owner && !!item.expires_at && item.status === 'Active' && (
          <Row label={t('mob.pkExpires')} value={String(item.expires_at).split('T')[0]} />
        )}
      </Card>

      {/* Poster identity — the trust anchor of Puruka */}
      <SectionHeader>{t('mob.pkSeller')}</SectionHeader>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: p.onPrimary, fontSize: 18, fontWeight: '800' }}>
            {(item.seller_name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>{item.seller_name}</Text>
          {!!item.seller_since && (
            <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 2 }}>
              {t('mob.pkMemberSince', { year: String(item.seller_since).slice(0, 4) })}
            </Text>
          )}
        </View>
      </Card>

      {item.is_owner ? (
        <>
          {item.status === 'Active' && (
            <Button
              label={t('mob.pkMarkSold')}
              onPress={() => update.mutate({ id, data: { action: 'sold' } })}
              loading={update.isPending}
            />
          )}
          {item.status === 'Sold' && (
            <Button
              label={t('mob.pkMarkAvailable')}
              onPress={() => update.mutate({ id, data: { action: 'available' } })}
              loading={update.isPending}
            />
          )}
          {item.status === 'Inactive' && (
            <Button
              label={t('mob.pkRenew')}
              onPress={() => update.mutate({ id, data: { action: 'renew' } })}
              loading={update.isPending}
            />
          )}
          <Button
            label={t('mob.pkEdit')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/puruka-new', params: { id: String(id) } })}
          />
          {item.status === 'Active' && (
            <Button
              label={t('mob.pkDeactivate')}
              variant="secondary"
              onPress={() => update.mutate({ id, data: { action: 'deactivate' } })}
            />
          )}
          <Button label={t('mob.pkDelete')} variant="danger" onPress={confirmDelete} loading={del.isPending} />
        </>
      ) : (
        <>
          {!!phone && item.status === 'Active' && (
            <>
              <Button label={`${t('mob.pkCall')}  ${phone}`} onPress={() => Linking.openURL(`tel:${phone}`)} />
              <Button
                label="WhatsApp"
                variant="secondary"
                onPress={() => Linking.openURL(`https://wa.me/${whatsappNumber(phone)}`)}
              />
            </>
          )}
          <View style={{ height: 8 }} />
          <Text
            onPress={askReport}
            style={{ color: p.textMuted, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 10 }}
          >
            {t('mob.pkReport')}
          </Text>
        </>
      )}
    </Screen>
  )
}
