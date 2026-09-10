import { useT, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// "EN | සිං" pill — same affordance as the desktop sidebar and login page
export function LangSwitcher({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const { lang, setLang } = useT()
  const btn = (code: Lang, label: string) => (
    <button
      key={code}
      type="button"
      onClick={() => setLang(code)}
      aria-pressed={lang === code}
      lang={code}
      className={cn(
        'rounded-md px-2.5 py-1 text-xs font-bold transition-colors duration-150 [&[lang=si]]:text-[13px] [&[lang=si]]:leading-none',
        lang === code ? 'bg-primary text-primary-foreground shadow-xs' : tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label="Language" className={cn('inline-flex gap-0.5 rounded-lg p-0.5', tone === 'dark' ? 'bg-white/10' : 'bg-muted', className)}>
      {btn('en', 'EN')}
      {btn('si', 'සිං')}
    </div>
  )
}
