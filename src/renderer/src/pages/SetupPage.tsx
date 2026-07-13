import React, { useRef, useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import loginIllustration from '../assets/login-illustration.png'
import { useT, LangSwitcher } from '../i18n'

interface SetupPageProps {
  onDone: () => void
}

// First-run screen (multi-samithi): resolve the office's samithi join code
// via the directory service and persist { slug, name, api_url } for this
// machine. Replaces the old hardcoded server IP.
export default function SetupPage({ onDone }: SetupPageProps): React.ReactElement {
  const { t } = useT()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolved, setResolved] = useState<{ slug: string; name: string } | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    codeRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    if (!code.trim()) {
      setError(t('setup.errCode'))
      return
    }
    setLoading(true)
    try {
      const record = await window.api.setup.resolve(code)
      setResolved(record)
    } catch (err: any) {
      setError(err?.message || t('setup.errResolve'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              <span>eS</span>
            </div>
            <h1>eSamithi</h1>
            <p>{t('setup.title')}</p>
          </div>

          {resolved ? (
            <div className="login-form">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--success-bg, rgba(34,197,94,0.1))',
                  color: 'var(--success, #16a34a)',
                  fontWeight: 600
                }}
              >
                <CheckCircle2 size={20} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{t('setup.foundIntro')}</div>
                  <div style={{ fontSize: '16px' }}>{resolved.name}</div>
                </div>
              </div>
              <button type="button" className="btn btn-primary login-btn" onClick={onDone}>
                {t('setup.continue')}
              </button>
              <button
                type="button"
                className="btn login-btn"
                style={{ marginTop: '8px' }}
                onClick={() => {
                  setResolved(null)
                  setCode('')
                }}
              >
                {t('setup.changeCode')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: '0 0 4px' }}>
                {t('setup.intro')}
              </p>
              {error && (
                <div className="login-error">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <div className="login-field">
                <label htmlFor="setup-code">
                  <KeyRound size={16} />
                  {t('setup.codeLabel')}
                </label>
                <input
                  ref={codeRef}
                  id="setup-code"
                  type="text"
                  placeholder={t('setup.codePlaceholder')}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                {loading ? t('setup.checking') : t('setup.check')}
              </button>
            </form>
          )}

          <div
            className="login-footer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
          >
            <LangSwitcher />
            <span>{t('setup.help')}</span>
          </div>
        </div>
      </div>

      <div className="login-right">
        <img src={loginIllustration} alt="Village community gathering" className="login-illustration" />
        <div className="login-right-overlay">
          <h2>{t('login.tagline')}</h2>
          <p>{t('login.taglineSub')}</p>
        </div>
      </div>
    </div>
  )
}
