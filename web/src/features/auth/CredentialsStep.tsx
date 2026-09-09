import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'motion/react'
import { Building2, Info, LogIn } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isApiError } from '@/lib/api/errors'
import type { SamithiContext } from '@/lib/api/samithi'
import { signIn, type SessionUser } from '@/lib/api/session'
import { useT } from '@/lib/i18n'
import { loginErrorKey } from './loginErrors'

const schema = z.object({
  username: z.string().trim().min(1, 'login.errUsername'),
  password: z.string().min(1, 'login.errPassword')
})
type Values = z.infer<typeof schema>

export function CredentialsStep({ samithi, onChangeSamithi, onSignedIn }: { samithi: SamithiContext; onChangeSamithi: () => void; onSignedIn: (user: SessionUser) => void }) {
  const { t } = useT()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  const onSubmit = async (values: Values) => {
    setServerError(null)
    try {
      onSignedIn(await signIn(values.username, values.password))
    } catch (err) {
      if (isApiError(err) && err.status === 429) setServerError(err.message)
      else {
        const k = loginErrorKey(err)
        setServerError(t(k.key, k.vars))
      }
    }
  }

  const msg = (key: string | undefined) => (key ? t(key as Parameters<typeof t>[0]) : null)

  return (
    <motion.form key="credentials" onSubmit={handleSubmit(onSubmit)} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('login.webTitle')}</h1>
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
            <Building2 className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">{samithi.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="tnum font-mono text-[10.5px]">
                {samithi.code}
              </Badge>
            </div>
          </div>
          <button type="button" onClick={onChangeSamithi} className="shrink-0 text-xs font-medium text-primary hover:underline">
            {t('setup.changeCode')}
          </button>
        </div>
        {samithi.maintenance?.message && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong className="font-semibold">{t('banner.maintenance')}</strong> {samithi.maintenance.message}
            </span>
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="username">{t('login.username')}</Label>
        <Input id="username" autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t('login.usernamePlaceholder')} aria-invalid={errors.username ? true : undefined} {...register('username')} />
        {errors.username && (
          <p role="alert" className="text-sm text-danger">
            {msg(errors.username.message)}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">{t('login.password')}</Label>
        <Input id="password" type="password" autoComplete="current-password" placeholder={t('login.passwordPlaceholder')} aria-invalid={errors.password ? true : undefined} {...register('password')} />
        {errors.password && (
          <p role="alert" className="text-sm text-danger">
            {msg(errors.password.message)}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? t('login.signingIn') : t('login.signIn')}
        {!isSubmitting && <LogIn />}
      </Button>
    </motion.form>
  )
}
