import React, { useEffect, useState } from 'react'
import { Alert, Image, Pressable, Switch, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { errorMessage } from '../api/client'
import {
  useCreatePurukaPost,
  useProfile,
  usePurukaCategories,
  usePurukaPost,
  useUpdatePurukaPost
} from '../api/hooks'
import { categoryIcon } from './(tabs)/puruka'
import { Button, Input, Screen, SectionHeader, useToast } from '../ui'

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
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ id?: string }>()
  const editId = params.id ? Number(params.id) : null

  const profile = useProfile()
  const categories = usePurukaCategories()
  const existing = usePurukaPost(editId ?? NaN)
  const create = useCreatePurukaPost()
  const update = useUpdatePurukaPost()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [negotiable, setNegotiable] = useState(false)
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [photoUris, setPhotoUris] = useState<string[]>([])
  const [prefilled, setPrefilled] = useState(false)

  // Prefill: from the existing post (edit) or the member profile (create)
  useEffect(() => {
    if (prefilled) return
    if (editId && existing.data) {
      const post = existing.data
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
    if (priceCents === null && !negotiable) {
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
          data: { title: title.trim(), category_id: categoryId, description, price: priceCents, negotiable, phone, location }
        },
        { onSuccess: () => { toast.show('success', t('mob.pkSaved')); router.back() }, onError }
      )
    } else {
      create.mutate(
        {
          title: title.trim(),
          category_id: categoryId,
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

  return (
    <Screen>
      {/* Photos — creation only; fixed once posted */}
      {!editId && (
        <>
          <SectionHeader>{t('mob.pkPhotos')}</SectionHeader>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {photoUris.map((uri) => (
              <View key={uri} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 86, height: 86, borderRadius: 12, backgroundColor: p.surfaceAlt }} />
                <Pressable
                  onPress={() => setPhotoUris((prev) => prev.filter((u) => u !== uri))}
                  accessibilityRole="button"
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: p.danger, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photoUris.length < MAX_PHOTOS && (
              <Pressable
                onPress={pickPhotos}
                accessibilityRole="button"
                style={{ width: 86, height: 86, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="camera-outline" size={24} color={p.textMuted} />
                <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 2 }}>{t('mob.pkAddPhoto')}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      <Input label={t('mob.pkTitleField')} value={title} onChangeText={setTitle} placeholder={t('mob.pkTitlePh')} maxLength={120} />

      <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', marginBottom: 8 }}>{t('mob.pkCategory')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {(categories.data ?? []).map((cat) => {
          const selected = categoryId === cat.id
          return (
            <Pressable
              key={cat.id}
              onPress={() => setCategoryId(cat.id)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 18,
                backgroundColor: selected ? p.primary : p.surface,
                borderWidth: 1,
                borderColor: selected ? p.primary : p.border
              }}
            >
              <Ionicons name={categoryIcon(cat.code)} size={15} color={selected ? p.onPrimary : p.textMuted} />
              <Text style={{ color: selected ? p.onPrimary : p.textMuted, fontSize: 13, fontWeight: '700' }}>
                {lang === 'si' ? cat.label_si : cat.label_en}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Input
        label={t('mob.pkPrice')}
        value={priceStr}
        onChangeText={setPriceStr}
        keyboardType="decimal-pad"
        placeholder="1500.00"
      />

      {/* Community fair-price notice (requirement P3.2) — guidance, never enforcement */}
      <View style={{ backgroundColor: p.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 14, marginTop: -6, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name="heart-outline" size={18} color={p.primary} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.primary, fontSize: 13, fontWeight: '700', marginBottom: 2 }}>{t('mob.pkTagline')}</Text>
          <Text style={{ color: p.textMuted, fontSize: 12, lineHeight: 17 }}>{t('mob.pkFairPrice')}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Switch value={negotiable} onValueChange={setNegotiable} trackColor={{ true: p.primary }} />
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>{t('mob.pkNegotiable')}</Text>
      </View>

      <Input
        label={t('mob.pkDesc')}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
        maxLength={1000}
      />
      <Input label={t('mob.pkLocation')} value={location} onChangeText={setLocation} maxLength={120} />
      <Input label={t('mob.pkPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />

      <Button label={editId ? t('mob.pkSave') : t('mob.pkPublish')} onPress={submit} loading={busy} />
    </Screen>
  )
}
