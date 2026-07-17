import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X, Loader2, Copy, Check, Inbox, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import type { Delta } from '../api'

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

// ── Sparkline ────────────────────────────────────────────────
// Bare trend shape for a tile: no axes, no tooltip, just the direction.
export function Sparkline({ data, color = 'var(--chart-1)' }: { data: number[]; color?: string }): React.ReactElement | null {
  // Gradient fills are referenced by id, so each sparkline needs its own.
  const id = useMemo(() => `sk${Math.random().toString(36).slice(2, 8)}`, [])
  if (data.length < 2) return null
  const points = data.map((v, i) => ({ i, v }))
  return (
    <div className="tile-spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Stat tile ────────────────────────────────────────────────
export function Tile({ icon, tint, label, value, sub, delta, spark }: {
  icon: React.ReactNode; tint: string; label: string; value: string; sub?: string
  delta?: Delta | null
  // Whether a rise is good: loans outstanding going up is not a win.
  spark?: { data: number[]; goodWhenUp?: boolean }
}): React.ReactElement {
  const goodWhenUp = spark?.goodWhenUp ?? true
  const deltaClass = delta ? (delta.dir === 'flat' ? 'flat' : (delta.dir === 'up') === goodWhenUp ? 'up' : 'down') : ''
  const DeltaIcon = delta?.dir === 'up' ? TrendingUp : delta?.dir === 'down' ? TrendingDown : Minus
  return (
    <div className="tile">
      <div className="tile-top">
        <span className="tile-label">{label}</span>
        <span className="tile-ico" style={{ background: tint + '22', color: tint }}>{icon}</span>
      </div>
      <div className="tile-value">{value}</div>
      <div className="tile-foot">
        <div>
          {sub && <div className="tile-sub">{sub}</div>}
          {delta && (
            <span className={`tile-delta ${deltaClass}`} title="Change vs. 7 days ago">
              <DeltaIcon size={12} />
              {delta.dir === 'flat' ? 'no change' : `${delta.pct}%`}
            </span>
          )}
        </div>
        {spark && spark.data.length > 1 && <Sparkline data={spark.data} color={tint} />}
      </div>
    </div>
  )
}

// ── Chart card ───────────────────────────────────────────────
export function ChartCard({ title, icon, actions, height = 260, empty, children }: {
  title: string; icon?: React.ReactNode; actions?: React.ReactNode; height?: number
  empty?: { title: string; hint?: string } | null
  children: React.ReactElement
}): React.ReactElement {
  return (
    <div className="card">
      <div className="card-head">
        {icon}
        <h3 style={{ flex: 1 }}>{title}</h3>
        {actions}
      </div>
      {empty ? (
        <EmptyState title={empty.title} hint={empty.hint} />
      ) : (
        <div className="chart-body" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Segmented control ────────────────────────────────────────
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}): React.ReactElement {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={`seg-btn ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────
export function Tabs<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string; icon?: React.ReactNode }[]; onChange: (v: T) => void
}): React.ReactElement {
  return (
    <div className="tabs no-print" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={`tab ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

// ── Search box ───────────────────────────────────────────────
export function SearchBox({ value, onChange, placeholder = 'Search…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}): React.ReactElement {
  return (
    <div className="search-box no-print">
      <Search size={14} />
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ── Sortable tables ──────────────────────────────────────────
export interface SortState<T> { key: keyof T; dir: 'asc' | 'desc' }

// Sorts rows locally and renders the header affordance. Nulls always sink to
// the bottom so an unreachable samithi never tops a "most members" sort.
export function useSort<T>(rows: T[], initial: SortState<T>): {
  sorted: T[]
  sort: SortState<T>
  toggle: (key: keyof T) => void
  th: (key: keyof T, label: string, style?: React.CSSProperties) => React.ReactElement
} {
  const [sort, setSort] = useState<SortState<T>>(initial)

  const toggle = useCallback((key: keyof T) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }, [])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sort.key] as unknown
      const bv = b[sort.key] as unknown
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sort])

  const th = useCallback((key: keyof T, label: string, style?: React.CSSProperties): React.ReactElement => {
    const on = sort.key === key
    return (
      <th className={`sortable ${on ? 'on' : ''}`} style={style} onClick={() => toggle(key)}
        aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {label}
        <span className="sort-ind">
          {on ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowDown size={11} />}
        </span>
      </th>
    )
  }, [sort, toggle])

  return { sorted, sort, toggle, th }
}

// ── Print letterhead ─────────────────────────────────────────
// Hidden on screen; the @media print rules reveal it so an exported PDF
// identifies itself.
export function PrintLetterhead({ title, meta }: { title: string; meta?: string }): React.ReactElement {
  return (
    <div className="print-only print-head">
      <h1>eSamithi Platform Console</h1>
      <div className="meta">
        {title}
        {meta ? ` · ${meta}` : ''}
        {` · generated ${new Date().toLocaleString()}`}
      </div>
    </div>
  )
}
