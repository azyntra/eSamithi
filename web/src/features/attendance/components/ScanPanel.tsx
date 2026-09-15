import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useScanSink } from '@/lib/hooks/useScanSink'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useScanCard } from '../queries'
import type { AttendanceMode } from '../types'
import { memberLabel } from '@/lib/members'

type Feedback = { seq: number; kind: 'ok' | 'dup' | 'err'; text: string }

const TONE = {
  ok: { text: 'text-success', ring: 'ring-success/40', icon: CheckCircle2 },
  dup: { text: 'text-warning', ring: 'ring-warning/40', icon: CheckCircle2 },
  err: { text: 'text-danger', ring: 'ring-danger/40', icon: XCircle }
} as const

// The counter's working surface. A keyboard-wedge scanner types the society ID
// and presses Enter, so the input keeps focus between scans and the result of
// each one is shown in place rather than as a toast that would queue up.
export function ScanPanel({ eventId, mode, onModeRequest }: { eventId: number; mode: AttendanceMode; onModeRequest: (m: AttendanceMode) => void }) {
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const scan = useScanCard(eventId)
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [session, setSession] = useState(0)
  const byAbsence = mode === 'absent'

  // Scan anywhere: a card swiped while the caret sits in a table still lands
  // in the box (requirements §7 P2).
  const sink = useCallback((char: string) => {
    setValue((v) => v + char)
    inputRef.current?.focus()
  }, [])
  useScanSink(!scan.isPending, sink)

  // A different event, or a different method, is a fresh count.
  useEffect(() => {
    setFeedback(null)
    setSession(0)
    setValue('')
    inputRef.current?.focus()
  }, [eventId, mode])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const scanned = value.trim()
    if (!scanned || scan.isPending) return
    setValue('')
    try {
      const res = await scan.mutateAsync(scanned)
      const name = memberLabel(res.member, t('members.unnamed'))
      if (res.already) {
        setFeedback({ seq: Date.now(), kind: 'dup', text: byAbsence ? t('att.alreadyAbsent', { name }) : t('att.alreadyMarked', { name }) })
      } else {
        setFeedback({ seq: Date.now(), kind: 'ok', text: byAbsence ? t('att.markedAbsent', { name }) : t('att.marked', { name }) })
        setSession((n) => n + 1)
      }
    } catch {
      setFeedback({ seq: Date.now(), kind: 'err', text: t('members.scanNotFound', { id: scanned }) })
    } finally {
      inputRef.current?.focus()
    }
  }

  const tone = feedback ? TONE[feedback.kind] : null
  const Icon = tone?.icon

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="att-mode" className="text-[13px] font-semibold">
          {t('att.mode')}
        </label>
        <NativeSelect id="att-mode" className="h-9 w-auto min-w-[190px]" value={mode} onChange={(e) => onModeRequest(e.target.value as AttendanceMode)}>
          <option value="present">{t('att.modePresent')}</option>
          <option value="absent">{t('att.modeAbsent')}</option>
        </NativeSelect>
        <span className="text-xs text-muted-foreground">{byAbsence ? t('att.modeAbsentHint') : t('att.modePresentHint')}</span>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className={cn('pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2', byAbsence ? 'text-warning' : 'text-primary')} />
          <Input
            ref={inputRef}
            name="scan"
            aria-label={byAbsence ? t('att.scanPromptAbsent') : t('att.scanPrompt')}
            placeholder={byAbsence ? t('att.scanPromptAbsent') : t('att.scanPrompt')}
            className={cn('pl-9 font-mono font-bold tracking-wide', tone && `ring-2 ${tone.ring}`)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" variant={byAbsence ? 'secondary' : 'default'} loading={scan.isPending} disabled={!value.trim()}>
          {byAbsence ? t('att.markAbsent') : t('att.mark')}
        </Button>
      </form>

      <div className="flex min-h-6 items-center gap-2" aria-live="polite">
        <AnimatePresence mode="wait">
          {feedback && Icon && tone && (
            <motion.div
              key={feedback.seq}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn('flex items-center gap-1.5 text-sm font-semibold', tone.text)}
            >
              <Icon className="size-4" />
              <span data-scan-feedback={feedback.kind}>{feedback.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {session > 0 && <span className="tnum ml-auto text-xs text-muted-foreground">{t('att.sessionCount', { count: session })}</span>}
      </div>
    </div>
  )
}
