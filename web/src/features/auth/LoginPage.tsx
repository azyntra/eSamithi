import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, ShieldCheck, Smartphone, Users } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { LangSwitcher } from '@/components/LangSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { appUrlFor, clearSamithi, isServedHere, saveSamithi, type SamithiContext } from '@/lib/api/samithi'
import { setSamithi, useSession } from '@/lib/api/session'
import { useT } from '@/lib/i18n'
import { CredentialsStep } from './CredentialsStep'
import { SamithiStep } from './SamithiStep'

type Step = { kind: 'code'; initial?: string } | { kind: 'credentials'; ctx: SamithiContext } | { kind: 'elsewhere'; ctx: SamithiContext; url: string }

export function LoginPage({ code, redirect }: { code?: string; redirect?: string }) {
  const { t } = useT()
  const router = useRouter()
  const { samithi } = useSession()
  const [step, setStep] = useState<Step>(() => (code ? { kind: 'code', initial: code } : samithi ? { kind: 'credentials', ctx: samithi } : { kind: 'code' }))

  const adopt = (ctx: SamithiContext) => {
    if (!isServedHere(ctx)) {
      const target = appUrlFor(ctx)
      if (target) {
        const url = new URL(target)
        url.searchParams.set('code', ctx.code)
        setStep({ kind: 'elsewhere', ctx, url: url.toString() })
        return
      }
    }
    saveSamithi(ctx)
    setSamithi(ctx)
    setStep({ kind: 'credentials', ctx })
  }

  // Automatic hop to the right server
  useEffect(() => {
    if (step.kind !== 'elsewhere') return
    const id = window.setTimeout(() => window.location.assign(step.url), 2500)
    return () => window.clearTimeout(id)
  }, [step])

  const changeSamithi = () => {
    clearSamithi()
    setSamithi(null)
    setStep({ kind: 'code', initial: step.kind === 'credentials' ? step.ctx.code : undefined })
  }

  const done = () => {
    const safe = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard'
    void router.navigate({ href: safe })
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="bg-hero-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -top-24 -right-24 size-[420px] rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-[360px] rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <BrandMark size={44} />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">eSamithi</div>
            <div className="text-xs text-white/60">{t('login.platform')}</div>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0, 1] }} className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">{t('login.tagline')}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">{t('login.taglineSub')}</p>
          <ul className="mt-8 grid gap-3 text-sm text-white/85">
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                <Users className="size-4" />
              </span>
              {t('nav.members')} · {t('nav.loans')} · {t('nav.reports')}
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                <Smartphone className="size-4" />
              </span>
              {t('login.desktopApp')} → Web · PWA
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                <ShieldCheck className="size-4" />
              </span>
              HTTPS · {t('sidebar.tagline')}
            </li>
          </ul>
        </motion.div>
        <div className="relative text-xs text-white/50">© {new Date().getFullYear()} eSamithi · Azyntra Technologies</div>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <BrandMark size={40} />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">eSamithi</div>
            <div className="text-xs text-muted-foreground">{t('login.platform')}</div>
          </div>
        </div>

        <Card className="w-full max-w-[440px] py-7 shadow-lg">
          <CardContent className="px-7">
            <AnimatePresence mode="wait" initial={false}>
              {step.kind === 'code' && <SamithiStep key="code" initialCode={step.initial} onResolved={adopt} />}
              {step.kind === 'credentials' && <CredentialsStep key="credentials" samithi={step.ctx} onChangeSamithi={changeSamithi} onSignedIn={done} />}
              {step.kind === 'elsewhere' && (
                <motion.div key="elsewhere" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4 text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-primary">
                    <ExternalLink className="size-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('login.otherServer', { name: step.ctx.name })}</p>
                  <Button asChild>
                    <a href={step.url}>{t('login.otherServerLink')}</a>
                  </Button>
                  <button type="button" onClick={() => setStep({ kind: 'code' })} className="text-xs text-primary hover:underline">
                    {t('setup.changeCode')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center gap-2">
          <LangSwitcher />
          <ThemeToggle />
        </div>
        <p className="tnum mt-4 text-[11px] text-subtle-foreground">web v{__APP_VERSION__}</p>
      </main>
    </div>
  )
}
