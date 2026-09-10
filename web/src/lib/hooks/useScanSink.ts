import { useEffect } from 'react'

// Counter scanners are keyboard wedges: they type the society ID wherever the
// caret happens to be. If a staff member has clicked a table row, the first
// characters of the next scan would be lost. This routes stray printable keys
// back to the scan box — but never while a form field, a menu or a dialog has
// the keyboard, so it cannot steal typing from anything else on the page.
export function useScanSink(enabled: boolean, onChar: (char: string) => void): void {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.length !== 1) return
      const el = e.target as HTMLElement | null
      if (el) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
        if (el.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      e.preventDefault()
      onChar(e.key)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [enabled, onChar])
}
