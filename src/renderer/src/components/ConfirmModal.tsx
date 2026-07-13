import React, { useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { pushModal, popModal, isTopModal, trapTabKey } from '../utils/modalStack'
import { useT } from '../i18n'

interface ConfirmModalProps {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

// Styled replacement for native confirm() — shows consequences and keeps the
// app's look. Render it conditionally and call onConfirm on accept.
// Registers on the modal stack so it can safely sit above another dialog.
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose
}: ConfirmModalProps): React.ReactElement {
  const { t } = useT()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const id = pushModal()
    const previouslyFocused = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()

    const handleKey = (e: KeyboardEvent): void => {
      if (!isTopModal(id) || !dialogRef.current) return
      if (e.key === 'Escape') onCloseRef.current()
      else if (e.key === 'Tab') trapTabKey(e, dialogRef.current)
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      popModal(id)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={(e) => e.target === overlayRef.current && onClose()} style={{ zIndex: 1100 }}>
      <div className="modal modal-sm" ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="modal-header gradient-header" style={danger ? { background: 'linear-gradient(135deg, #dc2626, #b91c1c)' } : undefined}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {danger && <AlertTriangle size={18} />} {title}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>{message}</div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => { onConfirm(); onClose() }}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
