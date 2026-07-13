import React, { useEffect, useRef, useState } from 'react'
import { pushModal, popModal, isTopModal, trapTabKey, getFocusable } from '../utils/modalStack'
import ConfirmModal from './ConfirmModal'

interface ModalOverlayProps {
  onClose: () => void
  // When true, once the user has typed into the form, Escape/backdrop-click
  // ask before discarding instead of silently losing the entry.
  guardUnsaved?: boolean
  zIndex?: number
  children: React.ReactNode
}

// Shared dialog chrome: Escape-to-close (top-most dialog only), focus trap,
// body scroll lock, focus restore, consistent backdrop behavior, and an
// optional unsaved-changes guard. Wrap the `.modal` div with this instead of
// rendering `.modal-overlay` and a keydown effect in every modal.
export default function ModalOverlay({
  onClose,
  guardUnsaved = false,
  zIndex,
  children
}: ModalOverlayProps): React.ReactElement {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)
  const mouseDownOnOverlay = useRef(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Keep latest callbacks available to the mount-once effect
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const guardRef = useRef(guardUnsaved)
  guardRef.current = guardUnsaved

  const requestClose = (): void => {
    if (guardRef.current && dirtyRef.current) setConfirmDiscard(true)
    else onCloseRef.current()
  }
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  useEffect(() => {
    const id = pushModal()
    const container = overlayRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!isTopModal(id) || !container) return
      if (e.key === 'Escape') {
        requestCloseRef.current()
      } else if (e.key === 'Tab') {
        trapTabKey(e, container)
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    // Any typing/toggling inside the dialog arms the discard guard
    const markDirty = (): void => {
      dirtyRef.current = true
    }
    container?.addEventListener('input', markDirty, true)

    // Give the dialog initial focus unless an autoFocus field already took it;
    // prefer a form field over the header close button.
    const focusTimer = window.setTimeout(() => {
      if (!container) return
      const active = document.activeElement
      if (active && active !== document.body && container.contains(active)) return
      const focusables = getFocusable(container)
      const firstField = focusables.find((el) =>
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
      )
      ;(firstField || focusables[0])?.focus()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      container?.removeEventListener('input', markDirty, true)
      popModal(id)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      style={zIndex !== undefined ? { zIndex } : undefined}
      onMouseDown={(e) => {
        mouseDownOnOverlay.current = e.target === overlayRef.current
      }}
      onClick={(e) => {
        // Only a click that both started and ended on the backdrop closes —
        // dragging a text selection out of an input must not dismiss the form
        if (e.target === overlayRef.current && mouseDownOnOverlay.current) requestClose()
      }}
    >
      {children}
      {confirmDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes in this form. Close it and discard them?"
          confirmLabel="Discard"
          danger
          onConfirm={() => onCloseRef.current()}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  )
}
