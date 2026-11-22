import React, { useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import { useT } from '../i18n'
import { formatDate } from '../lib/date'
import { ScalePressable } from './pressable'
import { BottomSheet } from './v2'
import { Button } from './index'

// Sign-in controls (redesign §5, §6.1). The PIN is never typed into a text
// field with the phone keyboard: an on-screen pad with large keys and dots
// that fill. Dates of birth are picked, never typed.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function PinDots({ value, max = 6, error }: { value: string; max?: number; error?: boolean }): React.ReactElement {
  const p = usePalette()
  const { t } = useT()
  const shown = Math.max(4, Math.min(max, value.length + (value.length < max ? 1 : 0)))
  return (
    <View accessible accessibilityLabel={t('mob.pinEntered', { n: value.length })} style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginVertical: spacing.lg }}>
      {Array.from({ length: shown }).map((_, i) => {
        const on = i < value.length
        const color = error ? p.danger : p.primary
        return <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: on ? color : 'transparent', borderWidth: 2, borderColor: on ? color : p.borderStrong }} />
      })}
    </View>
  )
}

export function PinPad({ value, onChange, max = 6 }: { value: string; onChange: (v: string) => void; max?: number }): React.ReactElement {
  const p = usePalette()
  const { t } = useT()
  const key = (k: string): React.ReactElement => (
    <ScalePressable
      key={k}
      accessibilityRole="button"
      accessibilityLabel={k}
      haptic="selection"
      scaleTo={0.92}
      onPress={() => { if (value.length < max) onChange(value + k) }}
      style={{ flex: 1, height: 64, borderRadius: 32, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: p.text, fontSize: typeScale.display, fontFamily: interFamily.semibold }}>{k}</Text>
    </ScalePressable>
  )
  return (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
      {[0, 3, 6].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: spacing.lg }}>{KEYS.slice(row, row + 3).map(key)}</View>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <View style={{ flex: 1 }} />
        {key('0')}
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.pinDelete')}
          haptic="selection"
          onPress={() => onChange(value.slice(0, -1))}
          onLongPress={() => onChange('')}
          style={{ flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="backspace-outline" size={28} color={p.textMuted} />
        </ScalePressable>
      </View>
    </View>
  )
}

// Date of birth: a field that opens day / month / year lists in a sheet.
// Value and onChange use YYYY-MM-DD, exactly what the API expects.
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { t, monthsLong } = useT()
  const [open, setOpen] = useState(false)
  const thisYear = new Date().getFullYear()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const [y, setY] = useState<number>(m ? Number(m[1]) : 1970)
  const [mo, setMo] = useState<number>(m ? Number(m[2]) : 1)
  const [d, setD] = useState<number>(m ? Number(m[3]) : 1)
  const years = useMemo(() => Array.from({ length: thisYear - 1919 }, (_, i) => thisYear - i), [thisYear])
  const daysIn = new Date(y, mo, 0).getDate()

  // Each list opens scrolled to its current value (a 1970 year would
  // otherwise sit 56 rows below a 2026 at the top)
  const ROW = 44 + spacing.xs
  const col = <T extends number>(items: T[], selected: T, onPick: (v: T) => void, label2: (v: T) => string): React.ReactElement => (
    <ScrollView
      style={{ flex: 1, maxHeight: 260 }}
      contentContainerStyle={{ gap: spacing.xs }}
      nestedScrollEnabled
      ref={(ref) => {
        const i = items.indexOf(selected)
        if (ref && i > 2) setTimeout(() => ref.scrollTo({ y: (i - 2) * ROW, animated: false }), 0)
      }}
    >
      {items.map((v) => {
        const on = v === selected
        return (
          <ScalePressable key={v} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onPick(v)} style={{ minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? p.primarySoft : 'transparent' }}>
            <Text style={{ color: on ? p.primaryOnSoft : p.text, fontSize: typeScale.body, fontFamily: on ? ty.family.bold : ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{label2(v)}</Text>
          </ScalePressable>
        )
      })}
    </ScrollView>
  )

  const confirm = (): void => {
    const day = Math.min(d, daysIn)
    onChange(`${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    setOpen(false)
  }

  return (
    <View style={{ marginBottom: spacing.lg - 2 }}>
      <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body), marginBottom: spacing.sm - 2 }}>{label}</Text>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : t('mob.pickDate')}`}
        onPress={() => setOpen(true)}
        scaleTo={0.99}
        style={{ minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: p.borderStrong, backgroundColor: p.surface, paddingHorizontal: spacing.lg - 2, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Ionicons name="calendar-outline" size={20} color={p.textMuted} />
        <Text style={{ flex: 1, color: value ? p.text : p.textSubtle, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{value ? formatDate(value) : t('mob.pickDate')}</Text>
        <Ionicons name="chevron-down" size={18} color={p.textMuted} />
      </ScalePressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label} footer={<Button label={t('common.confirm')} onPress={confirm} />}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {col(Array.from({ length: daysIn }, (_, i) => i + 1), Math.min(d, daysIn), setD, (v) => String(v))}
          {col(Array.from({ length: 12 }, (_, i) => i + 1), mo, setMo, (v) => monthsLong[v - 1] ?? String(v))}
          {col(years, y, setY, (v) => String(v))}
        </View>
      </BottomSheet>
    </View>
  )
}
