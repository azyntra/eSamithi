import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ensureSinhala, I18nProvider, sinhalaReady, translate, useT } from './index'

function Probe() {
  const { t, setLang } = useT()
  return (
    <button type="button" onClick={() => setLang('si')}>
      {t('nav.dashboard')} · {t('theme.dark')}
    </button>
  )
}

describe('the Sinhala dictionary arrives on demand', () => {
  it('carries both the generated and the web-only keys', async () => {
    expect(sinhalaReady()).toBe(false)
    await ensureSinhala()
    expect(sinhalaReady()).toBe(true)
    expect(translate('si', 'nav.dashboard')).not.toBe(translate('en', 'nav.dashboard'))
    expect(translate('si', 'theme.dark')).not.toBe(translate('en', 'theme.dark'))
  })

  // The provider used to memoise its value on the language alone, so a screen
  // that did not re-render for another reason stayed in English after the
  // dictionary landed — half the shell translated, half not.
  it('re-renders every consumer once it lands', async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    )
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('Dashboard')
    await act(async () => {
      button.click()
      await ensureSinhala()
    })
    expect(button.textContent).toBe(`${translate('si', 'nav.dashboard')} · ${translate('si', 'theme.dark')}`)
  })
})
