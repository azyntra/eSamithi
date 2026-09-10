import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import community from '@/assets/login/community.webp'
import officer from '@/assets/login/officer.webp'
import together from '@/assets/login/together.webp'
import { BrandMark } from '@/components/BrandMark'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// The sign-in panel used to be a flat gradient with a list of features. It is
// the first thing a treasurer sees each morning, so it shows the people the
// software is for instead: an officer at work, a family being helped, and a
// committee around one laptop.
const SLIDES: Array<{ src: string; caption: TranslationKey }> = [
  { src: officer, caption: 'login.slideOfficer' },
  { src: community, caption: 'login.slideCommunity' },
  { src: together, caption: 'login.slideTogether' }
]

const INTERVAL_MS = 7000

export function LoginHero() {
  const { t } = useT()
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  // WCAG 2.2.2: anything that moves by itself for more than five seconds needs
  // a way to stop it. Hovering or focusing the panel pauses it as well, so a
  // reader is never racing the timer.
  const [playing, setPlaying] = useState(true)
  const [held, setHeld] = useState(false)

  const paused = !playing || held
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !pausedRef.current) setIndex((i) => (i + 1) % SLIDES.length)
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [paused])

  const go = useCallback((next: number) => setIndex(((next % SLIDES.length) + SLIDES.length) % SLIDES.length), [])
  const slide = SLIDES[index]!

  return (
    <aside
      className="relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-10 text-white lg:flex xl:p-14"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={slide.src}
          src={slide.src}
          alt=""
          aria-hidden
          decoding="async"
          initial={{ opacity: 0, scale: reduced ? 1 : 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.1, ease: [0.4, 0, 0.2, 1] },
            scale: { duration: INTERVAL_MS / 1000 + 1.4, ease: 'linear' }
          }}
          className="absolute inset-0 size-full object-cover"
        />
      </AnimatePresence>

      {/* Readability first: white text sits over a photograph, so the scrim is
          darkest exactly where the brand, the headline and the caption land. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.92)_0%,rgba(6,10,18,0.62)_30%,rgba(6,10,18,0.74)_62%,rgba(6,10,18,0.96)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(6,10,18,0.88)_0%,rgba(6,10,18,0.62)_42%,rgba(6,10,18,0.18)_100%)]" />

      <div className="relative flex items-center gap-3">
        <BrandMark size={44} />
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight">eSamithi</div>
          <div className="text-xs text-white/70">{t('login.platform')}</div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0, 1] }} className="relative max-w-md">
        <h2 className="text-3xl leading-tight font-bold tracking-tight text-white xl:text-4xl">{t('login.tagline')}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">{t('login.taglineSub')}</p>
      </motion.div>

      <div className="relative grid gap-5">
        <div className="flex items-end justify-between gap-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={slide.caption}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0, 0, 0, 1] }}
              className="max-w-sm text-[15px] leading-relaxed font-medium text-white"
            >
              {t(slide.caption)}
            </motion.p>
          </AnimatePresence>

          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2" role="group" aria-label={t('login.slidesLabel')}>
              {SLIDES.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t('login.slideGo', { n: i + 1, total: SLIDES.length })}
                  aria-current={i === index ? 'true' : undefined}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none',
                    i === index ? 'w-7 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={t(playing ? 'login.slidePause' : 'login.slidePlay')}
              className="grid size-8 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>
          </div>
        </div>

        <div className="text-xs text-white/60">© {new Date().getFullYear()} eSamithi · Azyntra Technologies</div>
      </div>
    </aside>
  )
}
