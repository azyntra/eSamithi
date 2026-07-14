import React, { useRef, useState } from 'react'
import { AlertCircle, Lock, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth'
import { Button } from '../components/ui'

export default function Login(): React.ReactElement {
  const { login, verifyTotp } = useAuth()
  const [step, setStep] = useState<'creds' | 'totp'>('creds')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const totpRef = useRef<HTMLInputElement>(null)

  const submitCreds = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const token = await login(email.trim(), password)
      setMfaToken(token)
      setStep('totp')
      setTimeout(() => totpRef.current?.focus(), 50)
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally { setBusy(false) }
  }

  const submitTotp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      await verifyTotp(mfaToken, code.trim())
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="card">
          <div className="login-logo">eS</div>
          <h1>Platform Console</h1>
          <p className="tag">eSamithi operator access — restricted</p>

          {err && <div className="form-err"><AlertCircle size={15} /> {err}</div>}

          {step === 'creds' ? (
            <form onSubmit={submitCreds}>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" autoComplete="username" autoFocus
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Password</label>
                <input className="input" type="password" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" loading={busy} style={{ width: '100%' }}><Lock size={15} /> Continue</Button>
            </form>
          ) : (
            <form onSubmit={submitTotp}>
              <div className="field">
                <label>Authenticator code</label>
                <input ref={totpRef} className="input" inputMode="numeric" autoComplete="one-time-code"
                  placeholder="6-digit code or recovery code"
                  value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <Button type="submit" loading={busy} style={{ width: '100%' }}><ShieldCheck size={15} /> Verify &amp; sign in</Button>
              <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}
                onClick={() => { setStep('creds'); setErr(''); setCode('') }}>Back</button>
            </form>
          )}

          <div className="muted-hint">Protected by two-factor authentication</div>
        </div>
      </div>
    </div>
  )
}
