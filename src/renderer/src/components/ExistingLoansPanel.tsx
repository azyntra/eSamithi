import React from 'react'
import { formatCurrency } from '../utils/formatters'
import { useT } from '../i18n'
import type { Loan } from '../types'

interface Props {
  loans: Loan[]
  memberId: number | ''
  /** In cents; 0 = cap disabled. */
  maxLoanLimit: number
  /** Migration entry shows the list for context but no headroom (cap not applied there). */
  showHeadroom?: boolean
}

// The member's running loans, shown inside the loan-entry modals so the
// officer sees existing exposure before granting more. Headroom follows the
// server rule exactly: limit minus total outstanding PRINCIPAL (interest and
// fines are owed but do not consume borrowing room).
export default function ExistingLoansPanel({ loans, memberId, maxLoanLimit, showHeadroom = false }: Props): React.ReactElement | null {
  const { t, lang } = useT()

  if (memberId === '') return null
  const active = loans.filter(
    (l) => l.member_id === memberId && (l.status === 'Active' || l.status === 'Overdue')
  )
  if (active.length === 0) return null

  const totalPrincipal = active.reduce((s, l) => s + l.principal_owed, 0)
  const totalOutstanding = active.reduce((s, l) => s + l.principal_owed + l.interest_owed + l.fines_owed, 0)
  const headroom = maxLoanLimit > 0 ? maxLoanLimit - totalPrincipal : null

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '10px 12px',
        margin: '4px 0 12px',
        background: 'var(--bg-hover, rgba(30,100,212,0.04))',
        fontSize: '0.82rem'
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: '6px' }}>
        {t('lform.existingLoans')} ({active.length})
      </div>
      {active.map((l) => (
        <div
          key={l.id}
          style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '3px 0', flexWrap: 'wrap' }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            {new Date(l.date_issued).toLocaleDateString(lang === 'si' ? 'si-LK' : 'en-GB')}
            {' · '}
            {formatCurrency(l.principal_amount)}
            {l.status === 'Overdue' && (
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · {l.status}</span>
            )}
          </span>
          <span style={{ fontWeight: 600 }}>
            {formatCurrency(l.principal_owed + l.interest_owed + l.fines_owed)}
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px',
          borderTop: '1px solid var(--border)',
          marginTop: '6px',
          paddingTop: '6px',
          fontWeight: 700
        }}
      >
        <span>{t('lform.totalOutstandingShort')}</span>
        <span style={{ color: 'var(--danger)' }}>{formatCurrency(totalOutstanding)}</span>
      </div>
      {showHeadroom && headroom !== null && (
        <div
          style={{
            marginTop: '4px',
            fontWeight: 700,
            color: headroom > 0 ? 'var(--success, #16a34a)' : 'var(--danger)'
          }}
        >
          {headroom > 0
            ? t('lform.headroomRemaining', { amount: formatCurrency(headroom) })
            : t('lform.noHeadroom', { max: maxLoanLimit / 100 })}
        </div>
      )}
    </div>
  )
}
