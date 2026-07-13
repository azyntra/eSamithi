import React, { useEffect, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import type { ToastMessage } from '../types'

// Simple event-based toast system (avoids context complexity)
const toastListeners: Set<(toast: ToastMessage) => void> = new Set()

export function showToast(type: 'success' | 'error', message: string): void {
  const toast: ToastMessage = {
    // Identical messages share an id so duplicates refresh instead of stacking
    id: `${type}:${message}`,
    type,
    message
  }
  toastListeners.forEach((listener) => listener(toast))
}

// Errors need reading time; successes can be glanced at
const DURATION_MS = { success: 3000, error: 6000 }

export default function ToastContainer(): React.ReactElement {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const timersRef = useRef<Map<string, number>>(new Map())

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setExitingIds((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      setExitingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 200)
  }, [])

  useEffect(() => {
    const listener = (toast: ToastMessage): void => {
      setToasts((prev) => {
        // Dedupe: an identical toast already on screen just gets its timer reset
        if (prev.some((t) => t.id === toast.id)) return prev
        return [...prev, toast]
      })
      setExitingIds((prev) => {
        if (!prev.has(toast.id)) return prev
        const next = new Set(prev)
        next.delete(toast.id)
        return next
      })
      const existing = timersRef.current.get(toast.id)
      if (existing !== undefined) window.clearTimeout(existing)
      timersRef.current.set(
        toast.id,
        window.setTimeout(() => removeToast(toast.id), DURATION_MS[toast.type])
      )
    }

    toastListeners.add(listener)
    return () => {
      toastListeners.delete(listener)
    }
  }, [removeToast])

  if (toasts.length === 0) return <></>

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type}${exitingIds.has(toast.id) ? ' toast-exit' : ''}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          onClick={() => removeToast(toast.id)}
          style={{ cursor: 'pointer' }}
          title="Click to dismiss"
        >
          {toast.type === 'success' ? <CheckCircle /> : <XCircle />}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={(e) => {
              e.stopPropagation()
              removeToast(toast.id)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '2px',
              color: 'inherit',
              opacity: 0.7,
              flexShrink: 0
            }}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
