import React, { useState, useEffect, useRef } from 'react'
import ModalOverlay from '../components/ModalOverlay'
import { X, AlertCircle } from 'lucide-react'
import { useT } from '../i18n'

interface Props {
  onClose: () => void
  onConfirm: (reason: string) => void
}

export default function VoidModal({ onClose, onConfirm }: Props): React.ReactElement {
  const { t } = useT()
  const [reason, setReason] = useState('')


  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!reason.trim()) return
    onConfirm(reason.trim())
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-label={t('void.title')} aria-modal="true">
        <div className="modal-header gradient-header" style={{ background: 'linear-gradient(135deg, var(--danger), #b02a37)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
            <AlertCircle size={20} /> {t('void.title')}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')} style={{ color: 'white' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.9rem', marginBottom: '16px', color: 'var(--text-secondary)' }}>
              {t('void.confirmMsg')}
            </p>
            <div className="form-group">
              <label>{t('void.reasonLabel')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea 
                className="form-control" 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
                required 
                placeholder={t('void.reasonPlaceholder')}
                rows={3}
                autoFocus
              ></textarea>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-danger" disabled={!reason.trim()}>
              {t('void.confirmBtn')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
