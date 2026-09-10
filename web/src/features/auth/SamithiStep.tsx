import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveSamithi, type SamithiContext } from '@/lib/api/samithi'
import { useT } from '@/lib/i18n'
import { loginErrorKey } from './loginErrors'

export function SamithiStep({ initialCode = '', onResolved }: { initialCode?: string; onResolved: (ctx: SamithiContext) => void }) {
  const { t } = useT()
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) {
      setError(t('setup.errCode'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      onResolved(await resolveSamithi(clean))
    } catch (err) {
      const k = loginErrorKey(err)
      setError(t(k.key, k.vars))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.form key="code" onSubmit={submit} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }} className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('setup.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('setup.introWeb')}</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="samithi-code">{t('setup.codeLabel')}</Label>
        <Input
          id="samithi-code"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('setup.codePlaceholder')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="h-11 font-mono text-base tracking-[0.12em] uppercase placeholder:normal-case placeholder:tracking-normal"
          aria-invalid={error ? true : undefined}
          aria-describedby="samithi-code-help"
        />
        <p id="samithi-code-help" className="text-xs text-subtle-foreground">
          {t('setup.help')}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" loading={busy} className="w-full">
        {busy ? t('setup.checking') : t('setup.check')}
        {!busy && <ArrowRight />}
      </Button>
    </motion.form>
  )
}
