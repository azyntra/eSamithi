import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X, Loader2, Copy, Check, Inbox } from 'lucide-react'

// ── Toasts ───────────────────────────────────────────────────
interface Toast { id: number; kind: 'success' | 'error' | 'info'; msg: string }
const ToastCtx = createContext<(kind: Toast['kind'], msg: string) => void>(() => {})
export const useToast = (): ((kind: Toast['kind'], msg: string) => void) => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], msg: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => {
          const I = Icon[t.kind]
          const color = t.kind === 'success' ? 'var(--success)' : t.kind === 'error' ? 'var(--danger)' : 'var(--primary)'
          return (
            <div key={t.id} className={`toast ${t.kind}`}>
              <I size={17} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ flex: 1 }}>{t.msg}</span>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

// ── Buttons ──────────────────────────────────────────────────
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md'
  loading?: boolean
}
export function Button({ variant = 'primary', size = 'md', loading, children, disabled, ...rest }: BtnProps): React.ReactElement {
  return (
    <button className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 size={14} className="spin" />}
      {children}
    </button>
  )
}

// ── Badge ────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }): React.ReactElement {
  const cls = status === 'active' ? 'active' : status === 'suspended' ? 'suspended' : 'neutral'
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" style={{ background: 'currentColor' }} />
      {status}
    </span>
  )
}

// ── Modal ────────────────────────────────────────────────────
export function Modal({ title, icon, onClose, children, footer, wide }: {
  title: string; icon?: React.ReactNode; onClose: () => void
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean
}): React.ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {icon}
          <h3 style={{ flex: 1 }}>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ── Confirm dialog ───────────────────────────────────────────
export function useConfirm(): {
  confirm: (opts: { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean }) => Promise<boolean>
  node: React.ReactNode
} {
  const [state, setState] = useState<{ title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null)
  const confirm = useCallback((opts: { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => setState({ ...opts, resolve })), [])
  const close = (v: boolean): void => { state?.resolve(v); setState(null) }
  const node = state ? (
    <Modal title={state.title} onClose={() => close(false)}
      footer={<>
        <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
        <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state.confirmLabel || 'Confirm'}</Button>
      </>}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{state.message}</div>
    </Modal>
  ) : null
  return { confirm, node }
}

// ── Skeleton / empty ─────────────────────────────────────────
export function Skeleton({ h = 16, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }): React.ReactElement {
  return <div className="skel" style={{ height: h, width: w, ...style }} />
}
export function EmptyState({ title, hint }: { title: string; hint?: string }): React.ReactElement {
  return (
    <div className="empty">
      <Inbox size={34} />
      <h4>{title}</h4>
      {hint && <div style={{ fontSize: 12.5 }}>{hint}</div>}
    </div>
  )
}

// ── Copy button ──────────────────────────────────────────────
export function CopyChip({ text }: { text: string }): React.ReactElement {
  const [done, setDone] = useState(false)
  return (
    <button className="btn-icon" title="Copy" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) })
    }}>
      {done ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
    </button>
  )
}
