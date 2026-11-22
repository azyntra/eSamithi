import React, { useEffect, useState } from 'react'
import { Alert, Image, Pressable, Switch, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useT } from '../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { errorMessage } from '../api/client'
import {
  useCreatePurukaPost,
  useProfile,
  usePurukaCategories,
  usePurukaPost,
  useUpdatePurukaPost,
  type PurukaType
} from '../api/hooks'
import { categoryIcon } from './(tabs)/puruka'
import { Button, Chip, Input, ScalePressable, Screen, useCardStyle, useToast } from '../ui'
import { useType } from '../typography'

const MAX_PHOTOS = 3

// Resize/compress on-device so a photo costs ~200 KB on a village connection
async function compressPhoto(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1280 }).renderAsync()
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 })
  return saved.uri
}

// Doubles as the edit screen when opened with ?id= (photos are fixed after posting)
export default function PurukaNewPost(): React.ReactElement {
  const { t, lang } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const editId = params.id ? Number(params.id) : null

  const profile = useProfile()
  const categories = usePurukaCategories()
  const existing = usePurukaPost(editId ?? NaN)
  const create = useCreatePurukaPost()
  const update = useUpdatePurukaPost()

  const [type, setType] = useState<PurukaType>('sell')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [negotiable, setNegotiable] = useState(false)
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [photoUris, setPhotoUris] = useState<string[]>([])
  const [prefilled, setPrefilled] = useState(false)
  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const card = useCardStyle()

  // Prefill: from the existing post (edit) or the member profile (create)
  useEffect(() => {
    if (prefilled) return
    if (editId && existing.data) {
      const post = existing.data
      setType(post.type)
      setTitle(post.title)
      setCategoryId(post.category_id)
      setDescription(post.description ?? '')
      setPriceStr(post.price === null ? '' : String(post.price / 100))
      setNegotiable(post.negotiable === 1)
      setPhone(post.phone ?? '')
      setLocation(post.location ?? '')
      setPrefilled(true)
    } else if (!editId && profile.data) {
      setPhone(profile.data.phone ?? '')
      setLocation(profile.data.address ?? '')
      setPrefilled(true)
    }
  }, [editId, existing.data, profile.data, prefilled])

  const pickPhotos = async (): Promise<void> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS - photoUris.length,
        quality: 1
      })
      if (result.canceled) return
      const compressed: string[] = []
      for (const asset of result.assets.slice(0, MAX_PHOTOS - photoUris.length)) {
        compressed.push(await compressPhoto(asset.uri))
      }
      setPhotoUris((prev) => [...prev, ...compressed].slice(0, MAX_PHOTOS))
    } catch {
      // Picker cancelled or unavailable — nothing to do
    }
  }

  const busy = create.isPending || update.isPending

  const submit = (): void => {
    const priceCents = priceStr.trim() === '' ? null : Math.round(parseFloat(priceStr) * 100)
    if (!title.trim()) {
      Alert.alert('', t('mob.pkTitleField'))
      return
    }
    if (categoryId === null) {
      Alert.alert('', t('mob.pkCategory'))
      return
    }
    if (type === 'sell' && priceCents === null && !negotiable) {
      Alert.alert('', t('mob.pkPriceOrNegotiable'))
      return
    }
    if (priceCents !== null && (!Number.isFinite(priceCents) || priceCents < 0)) {
      Alert.alert('', t('mob.pkPrice'))
      return
    }

    const onError = (err: unknown): void => Alert.alert('', errorMessage(err, t('mob.errorLoad')))

    if (editId) {
      update.mutate(
        {
          id: editId,
          data: { title: title.trim(), category_id: categoryId, type, description, price: priceCents, negotiable, phone, location }
        },
        { onSuccess: () => { toast.show('success', t('mob.pkSaved')); router.back() }, onError }
      )
    } else {
      create.mutate(
        {
          title: title.trim(),
          category_id: categoryId,
          type,
          description,
          price: priceCents,
          negotiable,
          phone,
          location,
          photoUris
        },
        {
          onSuccess: () => {
            toast.show('success', t('mob.pkPosted2'))
            router.back()
          },
          onError
        }
      )
    }
  }

  const wanted = type === 'wanted'

  // Steps (redesign §6.5.3). Photos are fixed once posted, so editing skips them.
  type Step = 'type' | 'photos' | 'details' | 'price'
  const steps: Step[] = editId ? ['type', 'details', 'price'] : ['type', 'photos', 'details', 'price']
  const current = steps[Math.min(step, steps.length - 1)]
  const last = step >= steps.length - 1
  const stepTitle = {
    type: t('mob.pkStepType'),
    photos: t('mob.pkStepPhotos'),
    details: t('mob.pkStepDetails'),
    price: t('mob.pkStepPrice')
  }[current]

  const next = (): void => {
    if (current === 'details') {
      if (!title.trim()) return setStepError(t('mob.pkNeedTitle'))
      if (categoryId === null) return setStepError(t('mob.pkNeedCategory'))
    }
    setStepError(null)
    if (last) submit()
    else setStep((n) => n + 1)
  }
  const back = (): void => {
    setStepError(null)
    if (step === 0) router.back()
    else setStep((n) => n - 1)
  }

  const typeCard = (value: PurukaType, icon: keyof typeof Ionicons.glyphMap, label: string, hint: string): React.ReactElement => {
    const selected = type === value
    return (
      <ScalePressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        haptic="selection"
        onPress={() => setType(value)}
        style={[card, { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, borderWidth: selected ? 2 : 1, borderColor: selected ? p.primary : p.border }]}
      >
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: selected ? p.primarySoft : p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={26} color={selected ? p.primaryOnSoft : p.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading) }}>{label}</Text>
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{hint}</Text>
        </View>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={24} color={selected ? p.primary : p.textMuted} />
      </ScalePressable>
    )
  }

  return (
    <Screen>
      {/* Progress */}
      <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>
        {t('mob.pkStepOf', { n: step + 1, total: steps.length })}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {steps.map((s2, i) => (
          <View key={s2} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? p.primary : p.border }} />
        ))}
      </View>
      <Text accessibilityRole="header" style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title), marginBottom: spacing.lg }}>{stepTitle}</Text>

      {current === 'type' ? (
        <>
          {typeCard('sell', 'pricetag-outline', t('mob.pkTypeSell'), t('mob.pkSellHint'))}
          {typeCard('wanted', 'search-outline', t('mob.pkTypeWanted'), t('mob.pkWantedHint'))}
        </>
      ) : null}

      {current === 'photos' ? (
        <>
          <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), marginBottom: spacing.lg }}>{t('mob.pkPhotosHint')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {photoUris.map((uri) => (
              <View key={uri}>
                <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: radius.md, backgroundColor: p.surfaceAlt }} />
                <Pressable
                  onPress={() => setPhotoUris((prev) => prev.filter((u) => u !== uri))}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  hitSlop={8}
                  style={{ position: 'absolute', top: -8, right: -8, backgroundColor: p.text, borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: p.bg }}
                >
                  <Ionicons name="close" size={16} color={p.bg} />
                </Pressable>
              </View>
            ))}
            {photoUris.length < MAX_PHOTOS ? (
              <Pressable
                onPress={pickPhotos}
                accessibilityRole="button"
                style={{ width: 100, height: 100, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface }}
              >
                <Ionicons name="camera-outline" size={28} color={p.primary} />
                <Text style={{ color: p.primary, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro), marginTop: spacing.xs }}>{t('mob.pkAddPhoto')}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {current === 'details' ? (
        <>
          <Input label={t('mob.pkTitleField')} value={title} onChangeText={(v) => { setTitle(v); setStepError(null) }} placeholder={wanted ? t('mob.pkWantedTitlePh') : t('mob.pkTitlePh')} maxLength={120} />
          <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body), marginBottom: spacing.sm }}>{t('mob.pkCategory')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
            {(categories.data ?? []).map((cat) => (
              <Chip key={cat.id} label={lang === 'si' ? cat.label_si : cat.label_en} icon={categoryIcon(cat.code)} selected={categoryId === cat.id} onPress={() => { setCategoryId(cat.id); setStepError(null) }} />
            ))}
          </View>
          <Input label={t('mob.pkDesc')} value={description} onChangeText={setDescription} multiline numberOfLines={4} style={{ minHeight: 110, textAlignVertical: 'top' }} maxLength={1000} />
          <Input label={t('mob.pkLocation')} value={location} onChangeText={setLocation} maxLength={120} />
        </>
      ) : null}

      {current === 'price' ? (
        <>
          <Input
            label={wanted ? t('mob.pkBudget') : t('mob.pkPrice')}
            value={priceStr}
            onChangeText={setPriceStr}
            keyboardType="decimal-pad"
            placeholder={wanted ? t('mob.pkBudgetPh') : '1500.00'}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, marginBottom: spacing.lg }}>
            <Switch value={negotiable} onValueChange={setNegotiable} trackColor={{ true: p.primary }} accessibilityLabel={wanted ? t('mob.pkBudgetFlexible') : t('mob.pkNegotiable')} />
            <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{wanted ? t('mob.pkBudgetFlexible') : t('mob.pkNegotiable')}</Text>
          </View>
          {/* Community fair-price notice (requirement P3.2) — guidance for sellers only */}
          {!wanted ? (
            <View style={{ backgroundColor: p.primarySoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, flexDirection: 'row', gap: spacing.sm + 2 }}>
              <Ionicons name="heart-outline" size={20} color={p.primaryOnSoft} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.primaryOnSoft, fontSize: typeScale.caption, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.pkTagline')}</Text>
                <Text style={{ color: p.primaryOnSoft, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.pkFairPrice')}</Text>
              </View>
            </View>
          ) : null}
          <Input label={t('mob.pkPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
        </>
      ) : null}

      {stepError ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: p.dangerBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md }}>
          <Ionicons name="alert-circle-outline" size={20} color={p.danger} />
          <Text style={{ flex: 1, color: p.danger, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{stepError}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label={t('mob.stepBack')} variant="secondary" onPress={back} />
        </View>
        <View style={{ flex: 1.4 }}>
          <Button label={last ? (editId ? t('mob.pkSave') : t('mob.pkPublish')) : t('mob.stepNext')} onPress={next} loading={busy} />
        </View>
      </View>
    </Screen>
  )
}
