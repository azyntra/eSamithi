import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithApp } from '@/test/render'
import { StatusPill } from './StatusPill'

// The API answers in English. The desktop showed those words raw, which is how
// "Overdue" and "Void" ended up in the middle of a Sinhala screen.
describe('statuses the API returns in English', () => {
  it.each(['Active', 'Void', 'Overdue', 'Paid', 'Defaulted', 'Matured', 'Withdrawn', 'Inactive', 'Pending', 'Approved', 'Rejected', 'Cash', 'Bank', 'Sold', 'Removed', 'Deleted'])(
    'translates %s rather than printing it raw',
    (status) => {
      localStorage.setItem('esamithi-lang', 'si')
      renderWithApp(<StatusPill value={status} />)
      const pill = screen.getByText((_, el) => el?.tagName === 'SPAN' && (el.textContent ?? '').trim().length > 0)
      expect(pill.textContent?.trim()).not.toBe(status)
    }
  )

  it('falls back to the raw word for a status nobody has mapped yet', () => {
    renderWithApp(<StatusPill value="Hibernating" />)
    expect(screen.getByText('Hibernating')).toBeInTheDocument()
  })

  it('shows a dash rather than an empty badge when there is no status', () => {
    renderWithApp(<StatusPill value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
