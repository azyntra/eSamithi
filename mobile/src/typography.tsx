import { useMemo } from 'react'
import { useT } from './i18n'

// Language-aware typography. Setting an Inter fontFamily on text that
// contains Sinhala glyphs makes Android fall back to the SYSTEM Sinhala face
// at regular weight — bold silently disappears. So the family is resolved
// from the active language: Latin UI gets Inter, Sinhala UI gets Noto Sans
// Sinhala (which also carries Latin digits/letters for mixed strings like
// "රු. 1,250" and NIC numbers).
//
// Font files live in assets/fonts and are registered under these names by
// useFonts() in app/_layout.tsx. They ship inside the OTA update bundle —
// no binary change needed.

export const interFamily = {
  regular: 'Inter-Regular',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extrabold: 'Inter-ExtraBold'
} as const

const sinhalaFamily = {
  regular: 'NotoSansSinhala-Regular',
  semibold: 'NotoSansSinhala-SemiBold',
  bold: 'NotoSansSinhala-Bold',
  // Noto Sinhala has no 800 cut; Bold is the ceiling for Sinhala text.
  extrabold: 'NotoSansSinhala-Bold'
} as const

export type FontFamilySet = typeof interFamily | typeof sinhalaFamily

export interface TypeSet {
  family: FontFamilySet
  /** Line height for a font size — Sinhala needs the taller ratio. */
  lh: (size: number) => number
}

export function useType(): TypeSet {
  const { lang } = useT()
  return useMemo(() => {
    const family = lang === 'si' ? sinhalaFamily : interFamily
    const ratio = lang === 'si' ? 1.55 : 1.35
    return { family, lh: (size: number) => Math.round(size * ratio) }
  }, [lang])
}
