import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Money entry (ported from the desktop): the model is a raw rupee string such
// as "12500.50"; thousands separators are display-only, non-numeric keystrokes
// are rejected, and being type="text" it is immune to scroll-wheel changes.
const VALID_RAW = /^\d*\.?\d{0,2}$/

export function addThousands(raw: string): string {
  if (raw === '') return ''
  const [int, dec] = raw.split('.')
  const grouped = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

export const rupeesToCents = (raw: string): number => Math.round(Number(raw || 0) * 100)
export const centsToRupees = (cents: number): string => (cents / 100).toFixed(2)

interface RupeeInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'max'> {
  value: string
  onChange: (raw: string) => void
  max?: number // rupees
  tone?: 'income' | 'expense' | 'default'
}

export function RupeeInput({ value, onChange, max, tone = 'default', className, ...props }: RupeeInputProps) {
  const overMax = max !== undefined && value !== '' && parseFloat(value) > max
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">Rs.</span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={addThousands(value)}
        aria-invalid={overMax || props['aria-invalid'] || undefined}
        onChange={(e) => {
          const raw = e.target.value.replace(/,/g, '')
          if (raw === '') return onChange('')
          if (!VALID_RAW.test(raw)) return
          onChange(raw)
        }}
        className={cn('tnum pl-10 text-right font-semibold', tone === 'income' && 'text-success', tone === 'expense' && 'text-danger', className)}
        placeholder={props.placeholder ?? '0.00'}
      />
    </div>
  )
}
