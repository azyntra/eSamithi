import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

interface Option {
  value: string | number
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  required = false,
  disabled = false
}: SearchableSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listboxId = useRef(`ss-listbox-${Math.random().toString(36).slice(2, 8)}`)

  const selectedOption = options.find(o => String(o.value) === String(value))

  const filteredOptions = options.filter(o =>
    (o.label || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keep the highlighted option visible while arrowing through the list
  useEffect(() => {
    if (!isOpen) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, isOpen])

  const open = (): void => {
    if (disabled) return
    setSearch('')
    const selectedIdx = options.findIndex(o => String(o.value) === String(value))
    setHighlighted(selectedIdx >= 0 ? selectedIdx : 0)
    setIsOpen(true)
  }

  const close = (refocusTrigger = true): void => {
    setIsOpen(false)
    if (refocusTrigger) triggerRef.current?.focus()
  }

  const selectOption = (opt: Option): void => {
    onChange(opt.value)
    close()
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent): void => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) open()
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(h => Math.min(h + 1, filteredOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(h => Math.max(h - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setHighlighted(0)
        break
      case 'End':
        e.preventDefault()
        setHighlighted(Math.max(filteredOptions.length - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[highlighted]) selectOption(filteredOptions[highlighted])
        break
      case 'Escape':
        // Close only the dropdown, not the modal behind it
        e.preventDefault()
        e.stopPropagation()
        close()
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId.current}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={`form-control ${disabled ? 'disabled' : ''}`}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? 'var(--bg-hover)' : 'var(--bg-white)',
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)'
        }}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            title="Clear selection"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
              setIsOpen(false)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              color: 'var(--text-secondary)'
            }}
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={16} color="var(--text-secondary)" />
      </div>

      {/* Hidden input to handle 'required' validation if wrapped in a form */}
      <input
        type="text"
        value={value}
        onChange={() => {}}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        style={{ opacity: 0, position: 'absolute', top: '50%', left: '50%', zIndex: -1, width: 1, height: 1, pointerEvents: 'none' }}
      />

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--bg-white)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 50,
          maxHeight: '260px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
            <div className="search-container" style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlighted(0)
                }}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                role="searchbox"
                aria-controls={listboxId.current}
                aria-activedescendant={
                  filteredOptions[highlighted] ? `${listboxId.current}-opt-${highlighted}` : undefined
                }
                onClick={(e) => e.stopPropagation()}
                style={{ paddingLeft: '28px', padding: '6px 10px 6px 28px', fontSize: '0.85rem', borderRadius: '4px' }}
              />
            </div>
          </div>
          <div ref={listRef} id={listboxId.current} role="listbox" style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(value) === String(opt.value)
                const isHighlighted = idx === highlighted
                return (
                  <div
                    key={opt.value}
                    id={`${listboxId.current}-opt-${idx}`}
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => setHighlighted(idx)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      backgroundColor: isSelected
                        ? 'var(--primary-subtle)'
                        : isHighlighted
                          ? 'var(--bg-hover)'
                          : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: '0.9rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {opt.label}
                    </div>
                    {opt.sublabel && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
