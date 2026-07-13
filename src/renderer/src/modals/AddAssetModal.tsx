import React, { useState, useRef, useEffect } from 'react'
import ModalOverlay from '../components/ModalOverlay'
import { X, Box } from 'lucide-react'
import { showToast } from '../components/Toast'
import { useT } from '../i18n'
import type { PhysicalAsset } from '../types'

interface Props {
  onClose: () => void
  onCreated: () => void
  // When provided the modal edits the existing asset instead of creating one
  asset?: PhysicalAsset | null
}

export default function AddAssetModal({ onClose, onCreated, asset = null }: Props): React.ReactElement {
  const { t } = useT()
  const isEdit = asset !== null
  const [name, setName] = useState(asset?.name || '')
  const [quantity, setQuantity] = useState(asset ? String(asset.quantity) : '1')
  const [description, setDescription] = useState(asset?.description || '')
  const [submitting, setSubmitting] = useState(false)


  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    setSubmitting(true)
    try {
      const data = {
        name: name.trim(),
        quantity: parseInt(quantity),
        description: description.trim()
      }
      if (isEdit && asset) {
        await window.api.assets.update(asset.id, data)
        showToast('success', t('wform.assetUpdated'))
      } else {
        await window.api.assets.create(data)
        showToast('success', t('wform.assetRegistered'))
      }
      onCreated()
      onClose()
    } catch (error: any) {
      showToast('error', error.message || t('wform.assetSaveFailed'))
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} guardUnsaved>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header gradient-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box size={20} /> {isEdit ? t('wform.editAssetTitle') : t('wform.registerAssetTitle')}
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('wallet.assetName')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('wform.assetNamePlaceholder')} autoFocus />
            </div>

            <div className="form-group">
              <label>{t('wform.totalQuantity')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" className="form-control" value={quantity} onChange={(e) => setQuantity(e.target.value)} required min="0" />
            </div>

            <div className="form-group">
              <label>{t('wallet.descriptionCondition')}</label>
              <textarea className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('wform.assetDescPlaceholder')} rows={3}></textarea>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('common.saving') : isEdit ? t('wform.saveChanges') : t('wform.registerAsset')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}
