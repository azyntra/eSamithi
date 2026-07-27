import React from 'react'
import { Archive, Plus } from 'lucide-react'
import { useT } from '../i18n'

// Shown at the top of the loan entry modal during Migration Mode. Issuing a new
// loan and recording one already running on paper are different operations —
// one moves money out of a wallet, the other only records a position — so the
// officer picks which they are doing before filling anything in.
export default function LoanKindChooser({
  value,
  onChange
}: {
  value: 'new' | 'existing'
  onChange: (kind: 'new' | 'existing') => void
}): React.ReactElement {
  const { t } = useT()

  const option = (
    kind: 'new' | 'existing',
    icon: React.ReactNode,
    label: string,
    hint: string
  ): React.ReactElement => {
    const selected = value === kind
    return (
      <button
        type="button"
        onClick={() => onChange(kind)}
        aria-pressed={selected}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
          background: selected ? 'var(--primary-light)' : 'var(--bg-card)',
          color: 'inherit',
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.86rem', color: selected ? 'var(--primary)' : 'var(--text-primary)' }}>
          {icon}
          {label}
        </span>
        <span style={{ display: 'block', marginTop: 4, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {hint}
        </span>
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
      {option('new', <Plus size={15} />, t('loans.kindNew'), t('loans.kindNewHint'))}
      {option('existing', <Archive size={15} />, t('loans.kindExisting'), t('loans.kindExistingHint'))}
    </div>
  )
}
