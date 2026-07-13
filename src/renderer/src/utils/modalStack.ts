// Shared registry of open dialogs so stacked modals behave predictably:
// only the top-most dialog responds to Escape/Tab, and page scroll is
// locked while anything is open.

const stack: symbol[] = []

export function pushModal(): symbol {
  const id = Symbol('modal')
  stack.push(id)
  if (stack.length === 1) {
    document.body.style.overflow = 'hidden'
  }
  return id
}

export function popModal(id: symbol): void {
  const idx = stack.indexOf(id)
  if (idx !== -1) stack.splice(idx, 1)
  if (stack.length === 0) {
    document.body.style.overflow = ''
  }
}

export function isTopModal(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null && !el.getAttribute('aria-hidden')
  )
}

// Keep Tab / Shift+Tab cycling inside the dialog instead of escaping to the
// page behind it.
export function trapTabKey(e: KeyboardEvent, container: HTMLElement): void {
  const focusables = getFocusable(container)
  if (focusables.length === 0) {
    e.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey) {
    if (!active || active === first || !container.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  } else if (!active || active === last || !container.contains(active)) {
    e.preventDefault()
    first.focus()
  }
}
