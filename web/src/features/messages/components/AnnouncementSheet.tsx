import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/form/Field'
import { FormSheet } from '@/components/form/FormSheet'
import { MemberPicker } from '@/components/MemberPicker'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import { toDateInput } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { useCreateAnnouncement, useUpdateAnnouncement } from '../queries'
import { announcementError, scrubAnnouncement, type Announcement, type AnnouncementPayload, type AnnouncementType } from '../types'

const EMPTY: AnnouncementPayload = {
  type: 'general',
  title: '',
  body: null,
  deceased_name: null,
  deceased_member_id: null,
  funeral_date: null,
  funeral_location: null,
  event_date: null
}

function fromAnnouncement(a: Announcement): AnnouncementPayload {
  return {
    type: a.type,
    title: a.title,
    body: a.body,
    deceased_name: a.deceased_name,
    deceased_member_id: a.deceased_member_id,
    funeral_date: toDateInput(a.funeral_date) || null,
    funeral_location: a.funeral_location,
    event_date: toDateInput(a.event_date) || null
  }
}

// Publishing pushes a notification to every member using the mobile app, so
// the notice is written in a sheet and reviewed before it goes out.
export function AnnouncementSheet({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Announcement | null }) {
  const { t } = useT()
  const create = useCreateAnnouncement()
  const update = useUpdateAnnouncement()
  const [form, setForm] = useState<AnnouncementPayload>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(editing ? fromAnnouncement(editing) : EMPTY)
    setDirty(false)
    setError(null)
  }, [open, editing])

  function set<K extends keyof AnnouncementPayload>(key: K, value: AnnouncementPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = scrubAnnouncement(form)
    const bad = announcementError(payload)
    if (bad) {
      return setError(bad === 'title' ? t('msg.titleRequired') : bad === 'deceased' ? t('msg.deceasedRequired') : t('msg.eventDateRequired'))
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload })
        toast.success(t('msg.updated'))
      } else {
        await create.mutateAsync(payload)
        toast.success(t('msg.published'))
      }
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const busy = create.isPending || update.isPending

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('msg.editAnnouncement') : t('msg.newAnnouncement')}
      description={editing ? undefined : t('msg.pushHint')}
      dirty={dirty}
      submitting={busy}
      submitLabel={editing ? t('common.save') : t('msg.publish')}
      onSubmit={submit}
    >
      <div className="grid gap-4">
        <Field label={t('common.type')} required>
          {({ id }) => (
            <NativeSelect id={id} value={form.type} onChange={(e) => set('type', e.target.value as AnnouncementType)}>
              <option value="general">{t('msg.typeGeneral')}</option>
              <option value="death">{t('msg.typeDeath')}</option>
              <option value="meeting">{t('msg.typeMeeting')}</option>
            </NativeSelect>
          )}
        </Field>

        <Field label={t('msg.title')} required>
          {({ id }) => <Input id={id} value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />}
        </Field>

        {form.type === 'death' && (
          <>
            <Field label={t('msg.deceasedName')} required>
              {({ id }) => <Input id={id} value={form.deceased_name ?? ''} onChange={(e) => set('deceased_name', e.target.value)} />}
            </Field>
            <Field label={t('msg.deceasedMember')} description={t('msg.deceasedMemberHint')}>
              {({ id }) => <MemberPicker id={id} value={form.deceased_member_id} onChange={(v) => set('deceased_member_id', v)} placeholder={t('lform.selectMember')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('msg.funeralDate')}>
                {({ id }) => <Input id={id} type="date" value={form.funeral_date ?? ''} onChange={(e) => set('funeral_date', e.target.value || null)} />}
              </Field>
              <Field label={t('msg.funeralLocation')}>
                {({ id }) => <Input id={id} value={form.funeral_location ?? ''} onChange={(e) => set('funeral_location', e.target.value)} />}
              </Field>
            </div>
          </>
        )}

        {form.type === 'meeting' && (
          <Field label={t('msg.eventDate')} required>
            {({ id }) => <Input id={id} type="date" value={form.event_date ?? ''} onChange={(e) => set('event_date', e.target.value || null)} />}
          </Field>
        )}

        <Field label={t('msg.body')}>
          {({ id }) => <Textarea id={id} rows={5} value={form.body ?? ''} onChange={(e) => set('body', e.target.value)} placeholder={t('msg.bodyPlaceholder')} />}
        </Field>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </FormSheet>
  )
}
