import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '@/test/render'
import { countdown, operatorLabel, SupportBanner } from './SupportBanner'

const state = {
  status: 'authenticated' as const,
  user: { id: 0, username: 'eSamithi Support (ops@esamithi.lk)', full_name: 'eSamithi Support', role: 'admin' as const },
  samithi: { code: '', slug: 'samithi01', name: 'Maranadhara Samithiya', api_url: '/api/v1' },
  expiresAt: 0,
  support: { actor: 'sa:3', sid: 'abc123', expiresAt: 0, returnTo: 'https://console.esamithi.com' }
}
const exitSupport = vi.fn(() => 'https://console.esamithi.com/admin/#/?exit=abc123')

vi.mock('@/lib/api/session', () => ({
  useSession: () => state,
  exitSupport: () => exitSupport()
}))

// The society's own staff must be able to see, without asking anyone, that
// someone from eSamithi is inside their books and for how much longer.
describe('support banner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    state.support = { actor: 'sa:3', sid: 'abc123', expiresAt: Date.now() + 42 * 60_000 + 7_000, returnTo: 'https://console.esamithi.com' }
    exitSupport.mockClear()
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('names the society and the operator, and counts the hour down', () => {
    renderWithApp(<SupportBanner />)
    const banner = screen.getByRole('region', { name: /support session/i })
    expect(banner.textContent).toContain('Maranadhara Samithiya')
    expect(banner.textContent).toContain('ops@esamithi.lk')
    expect(banner.textContent).toContain('42:07')

    act(() => vi.advanceTimersByTime(8_000))
    expect(banner.textContent).toContain('41:59')
  })

  it('exit leaves for the console, which is the only place that can revoke it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderWithApp(<SupportBanner />)
    await user.click(screen.getByRole('button', { name: /exit samithi/i }))
    expect(exitSupport).toHaveBeenCalledOnce()
    expect(window.location.href).toBe('https://console.esamithi.com/admin/#/?exit=abc123')
  })

  it('leaves by itself the moment the hour is up, before the next call can 401', () => {
    state.support = { ...state.support, expiresAt: Date.now() + 2_000 }
    renderWithApp(<SupportBanner />)
    expect(exitSupport).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(3_000))
    expect(exitSupport).toHaveBeenCalled()
  })

  it('reads the operator out of the synthetic username, and copes when there is none', () => {
    expect(operatorLabel('eSamithi Support (ops@esamithi.lk)', 'sa:3')).toBe('ops@esamithi.lk')
    expect(operatorLabel('someone', 'sa:3')).toBe('someone')
    expect(operatorLabel(undefined, 'sa:3')).toBe('sa:3')
  })

  it('never counts past zero', () => {
    expect(countdown(0)).toBe('0:00')
    expect(countdown(-5000)).toBe('0:00')
    expect(countdown(59_999)).toBe('0:59')
  })
})
