import { afterEach, describe, expect, it, vi } from 'vitest'
import { printHtml } from './print'

// Chrome often never fires `afterprint` after "Save as PDF". The Print button
// awaits printHtml, so it must resolve once the dialog has been opened, not wait
// for an event that may never come.
describe('printHtml', () => {
  afterEach(() => vi.restoreAllMocks())

  it('resolves once the print dialog has opened, even if afterprint never fires', async () => {
    const print = vi.fn() // never calls onafterprint
    const append = document.body.appendChild.bind(document.body)
    vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
      const el = append(node)
      if (el instanceof HTMLIFrameElement) {
        Object.defineProperty(el.contentWindow!, 'print', { value: print, configurable: true })
        queueMicrotask(() => el.onload?.(new Event('load')))
      }
      return el
    })

    const settled = vi.fn()
    void printHtml('<p>card</p>').then(settled)
    await vi.waitFor(() => expect(settled).toHaveBeenCalled(), { timeout: 1000 })
    expect(print).toHaveBeenCalledTimes(1)
  })
})
