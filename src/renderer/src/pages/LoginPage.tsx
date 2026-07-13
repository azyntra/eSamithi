import React, { useState, useRef, useEffect } from 'react'
import { Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
import loginIllustration from '../assets/login-illustration.png'
import { useT, LangSwitcher } from '../i18n'

interface LoginPageProps {
  onLogin: (user: { id: number; username: string; full_name: string; role: string }) => void
}

export default function LoginPage({ onLogin }: LoginPageProps): React.ReactElement {
  const { t } = useT()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [appVersion, setAppVersion] = useState('v1.0.0')
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    usernameRef.current?.focus()
    // Fetch the real app version
    if (window.api && window.api.updater) {
      window.api.updater.getVersion().then(v => setAppVersion(`v${v}`)).catch(() => {})
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError(t('login.errUsername'))
      return
    }
    if (!password) {
      setError(t('login.errPassword'))
      return
    }

    setLoading(true)
    try {
      const result = await window.api.auth.login(username.trim(), password)
      onLogin(result.user)
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Left: Login Form */}
      <div className="login-left">
        <div className="login-card">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-logo">
              <span>eS</span>
            </div>
            <h1>eSamithi</h1>
            <p>{t('login.platform')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-username">
                <User size={16} />
                {t('login.username')}
              </label>
              <input
                ref={usernameRef}
                id="login-username"
                type="text"
                placeholder={t('login.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">
                <Lock size={16} />
                {t('login.password')}
              </label>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <div className="login-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <LangSwitcher />
            <span>{t('login.desktopApp')} — {appVersion}</span>
          </div>
        </div>
      </div>

      {/* Right: Illustration */}
      <div className="login-right">
        <img
          src={loginIllustration}
          alt="Village community gathering"
          className="login-illustration"
        />
        <div className="login-right-overlay">
          <h2>{t('login.tagline')}</h2>
          <p>{t('login.taglineSub')}</p>
        </div>
      </div>
    </div>
  )
}

