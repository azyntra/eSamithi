import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/api/errors'
import { todayIso } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { useCreateEvent } from '../queries'
import type { AttendanceMode, EventType } from '../types'

// The method is chosen up front because it decides what an unmarked member
// means; changing it later clears the marks.
export function CreateEventDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: number) => void }) {
  const { t } = useT()
  const create = useCreateEvent()
  const [type, setType] = useState<EventType>('meeting')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayIso())
  const [mode, setMode] = useState<AttendanceMode>('present')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setType('meeting')
    setTitle('')
    setDate(todayIso())
    setMode('present')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError(t('att.titleRequired'))
    setError(null)
    try {
      const res = await create.mutateAsync({ type, title: title.trim(), event_date: date, attendance_mode: mode })
      toast.success(t('att.created'))
      reset()
      onOpenChange(false)
      onCreated(res.id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="size-5 text-primary" /> {t('att.newEvent')}
            </DialogTitle>
            <DialogDescription>{t('att.subtitle')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <Field label={t('att.eventType')} required>
              {({ id }) => (
                <NativeSelect id={id} value={type} onChange={(e) => setType(e.target.value as EventType)}>
                  <option value="meeting">{t('att.typeMeeting')}</option>
                  <option value="funeral">{t('att.typeFuneral')}</option>
                  <option value="other">{t('att.typeOther')}</option>
                </NativeSelect>
              )}
            </Field>
            <Field label={t('common.date')} required>
              {({ id }) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}
            </Field>
            <Field label={t('att.eventTitle')} required className="sm:col-span-2">
              {({ id }) => <Input id={id} value={title} onChange={(e) => { setTitle(e.target.value); setError(null) }} placeholder={t('att.titlePlaceholder')} autoFocus />}
            </Field>
            <Field label={t('att.mode')} required description={mode === 'absent' ? t('att.modeAbsentHint') : t('att.modePresentHint')} className="sm:col-span-2">
              {({ id, describedBy }) => (
                <NativeSelect id={id} aria-describedby={describedBy} value={mode} onChange={(e) => setMode(e.target.value as AttendanceMode)}>
                  <option value="present">{t('att.modePresent')}</option>
                  <option value="absent">{t('att.modeAbsent')}</option>
                </NativeSelect>
              )}
            </Field>
          </div>
          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t('att.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
