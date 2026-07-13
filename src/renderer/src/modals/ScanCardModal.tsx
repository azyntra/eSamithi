import React, { useEffect, useRef, useState } from 'react'
import { ScanLine } from 'lucide-react'
import ModalOverlay from '../components/ModalOverlay'
import { useT } from '../i18n'

interface ScanCardModalProps {
  onClose: () => void
  onFound: (memberId: number) => void
}

// Reads the society ID from the mobile app's membership-card QR via a
// keyboard-wedge USB scanner (scanners type the code and press Enter),
// or typed manually. Exact society_id match wins; a single fuzzy hit is
// accepted as a fallback so partial IDs still work.
export default function ScanCardModal({ onClose, onFound }: ScanCardModalProps): React.ReactElement {
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const scanned = value.trim()
    if (!scanned || searching) return
    setSearching(true)
    setNotFound(null)
    try {
      const result = await window.api.members.getAll({ search: scanned, page: 1, limit: 10 })
      const exact = result.members.find(
        (m) => m.society_id.toLowerCase() === scanned.toLowerCase()
      )
      const match = exact ?? (result.members.length === 1 ? result.members[0] : undefined)
      if (match) {
        onFound(match.id)
        onClose()
      } else {
        setNotFound(scanned)
        inputRef.current?.select()
      }
    } catch {
      setNotFound(scanned)
      inputRef.current?.select()
    } finally {
      setSearching(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal modal-sm" role="dialog" aria-label={t('members.scanTitle')} aria-modal="true">
        <div className="modal-body">
          <div style={{ textAlign: 'center', padding: '8px 4px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--primary-light, rgba(59,130,246,0.12))',
                color: 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}
            >
              <ScanLine size={28} />
            </div>
            <h4 style={{ marginBottom: '6px' }}>{t('members.scanTitle')}</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {t('members.scanHint')}
            </p>
            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                className="form-control"
                style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700 }}
                placeholder={t('common.societyId')}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  setNotFound(null)
                }}
                onBlur={() => inputRef.current?.focus()}
                autoComplete="off"
                spellCheck={false}
              />
            </form>
            <div style={{ minHeight: '22px', marginTop: '10px' }}>
              {searching && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {t('members.scanning')}
                </span>
              )}
              {notFound && !searching && (
                <span style={{ fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600 }}>
                  {t('members.scanNotFound', { id: notFound })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
