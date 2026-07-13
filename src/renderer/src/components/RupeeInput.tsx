import React from 'react'

interface RupeeInputProps {
  // Raw numeric string in rupees, e.g. "12500.50" — same model the forms
  // already keep in state; commas are only a display concern here.
  value: string
  onChange: (raw: string) => void
  required?: boolean
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  id?: string
  // Maximum in rupees; exceeding it blocks form submission with a message
  max?: number
  style?: React.CSSProperties
}

// Only digits and up to two decimals ever reach onChange
const VALID_RAW = /^\d*\.?\d{0,2}$/

function addThousands(raw: string): string {
  if (raw === '') return ''
  const [int, dec] = raw.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

// Money entry field: text input that formats thousands separators as you
// type, rejects non-numeric keystrokes, and (being type="text") is immune to
// scroll-wheel value changes and 'e'/'-' that plague type="number".
export default function RupeeInput({
  value,
  onChange,
  required = false,
  disabled = false,
  autoFocus = false,
  placeholder = '0.00',
  id,
  max,
  style
}: RupeeInputProps): React.ReactElement {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '') {
      onChange('')
      return
    }
    if (!VALID_RAW.test(raw)) return // ignore the invalid keystroke
    onChange(raw)
  }

  const overMax = max !== undefined && value !== '' && parseFloat(value) > max

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className="form-control"
      value={addThousands(value)}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder}
      style={style}
      ref={(el) => {
        el?.setCustomValidity(
          overMax ? `Amount cannot exceed Rs. ${addThousands(String(max))}` : ''
        )
      }}
    />
  )
}
