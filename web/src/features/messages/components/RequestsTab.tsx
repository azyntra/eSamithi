import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Inbox, Phone, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { formatDateTime } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { useMemberRequests, useReviewRequest } from '../queries'
import type { MemberRequest, RequestStatus } from '../types'
import { memberLabel } from '@/lib/members'

// Members submit loan enquiries and detail corrections from the mobile app;
// this is the office side of that queue. Approving a loan request does not
// create a loan — the money still has to be issued in the loan portfolio,
// which is what the hint links to.
// What a request is, in the office's words. Concerns carry their category in
// `purpose`; child-safety reports are flagged so they are never missed.
function requestLabel(r: MemberRequest, t: ReturnType<typeof useT>['t']): string {
  if (r.type === 'loan') return t('msg.reqLoan')
  if (r.type === 'correction') return t('msg.reqCorrection')
  const cat = r.purpose === 'child_safety' ? t('msg.concernChildSafety') : r.purpose === 'content' ? t('msg.concernContent') : t('msg.concernOther')
  return `${t('msg.reqConcern')} · ${cat}`
}

export function RequestsTab({ pendingOnly, onFilterChange }: { pendingOnly: boolean; onFilterChange: (pending: boolean) => void }) {
  const { t, lang } = useT()
  const list = useMemberRequests(pendingOnly ? 'Pending' : undefined)
  const review = useReviewRequest()
  const [target, setTarget] = useState<{ req: MemberRequest; status: Extract<RequestStatus, 'Approved' | 'Rejected' | 'Done'> } | null>(null)
  const [note, setNote] = useState('')

  async function submit() {
    if (!target) return
    try {
      await review.mutateAsync({ id: target.req.id, status: target.status, staff_note: note.trim() || undefined })
      toast.success(target.status === 'Done' ? t('msg.concernHandledToast') : target.status === 'Approved' ? t('msg.approvedToast') : t('msg.rejectedToast'))
      setTarget(null)
      setNote('')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const rows = list.data ?? []

  return (
    <div className="grid gap-4">
      <Tabs value={pendingOnly ? 'pending' : 'all'} onValueChange={(v) => onFilterChange(v === 'pending')}>
        <TabsList>
          <TabsTrigger value="pending">{t('msg.requestsPending')}</TabsTrigger>
          <TabsTrigger value="all">{t('msg.requestsAll')}</TabsTrigger>
        </TabsList>
        {/* Declared so each trigger's aria-controls resolves; the queue itself
            renders below, identical for both filters. */}
        <TabsContent value="pending" />
        <TabsContent value="all" />
      </Tabs>

      {list.isPending ? (
        <div className="grid gap-3" data-skeleton="requests">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t('msg.noRequests')} />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card data-request={r.id}>
                <CardContent className="grid gap-2 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.type === 'concern' && r.purpose === 'child_safety' ? (
                      <Badge variant="danger" className="gap-1 text-[11px]">
                        <ShieldAlert className="size-3" /> {t('msg.concernChildSafety')}
                      </Badge>
                    ) : null}
                    <span className="text-sm font-semibold">{requestLabel(r, t)}</span>
                    <StatusPill value={r.status} />
                    <span className="ml-auto text-xs text-subtle-foreground">{formatDateTime(r.created_at, lang)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link to="/members/$memberId" params={{ memberId: r.member_id }} className="font-medium text-primary hover:underline">
                      {memberLabel({ full_name: r.member_name }, t('members.unnamed'))}
                    </Link>
                    <Badge variant="outline" className="tnum text-[11px]">
                      {r.member_society_id}
                    </Badge>
                    {r.member_phone && (
                      <a href={`tel:${r.member_phone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <Phone className="size-3" /> {r.member_phone}
                      </a>
                    )}
                  </div>
                  {r.type === 'loan' && (
                    <p className="text-sm text-muted-foreground">
                      {t('common.amount')}: <strong className="tnum text-foreground">{r.amount != null ? formatCurrency(r.amount) : '—'}</strong>
                      {r.purpose ? ` · ${t('msg.purpose')}: ${r.purpose}` : ''}
                    </p>
                  )}
                  {r.message && <p className="text-sm whitespace-pre-line">{r.message}</p>}
                  {r.staff_note && (
                    <p className="text-sm text-primary">
                      {t('msg.staffNote')}: {r.staff_note}
                    </p>
                  )}
                  {r.status === 'Pending' && r.type === 'concern' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={() => { setNote(''); setTarget({ req: r, status: 'Done' }) }}>
                        {t('msg.concernMarkHandled')}
                      </Button>
                    </div>
                  )}
                  {r.status === 'Pending' && r.type !== 'concern' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={() => { setNote(''); setTarget({ req: r, status: 'Approved' }) }}>
                        {t('msg.approve')}
                      </Button>
                      <Button size="sm" variant="outline" className="text-danger hover:bg-danger-soft" onClick={() => { setNote(''); setTarget({ req: r, status: 'Rejected' }) }}>
                        {t('msg.reject')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target?.status === 'Done' ? t('msg.concernMarkHandled') : target?.status === 'Approved' ? t('msg.approve') : t('msg.reject')}</DialogTitle>
            <DialogDescription>
              {target ? `${requestLabel(target.req, t)} — ${target.req.member_name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {target?.status === 'Approved' && target.req.type === 'loan' && (
              <p className="rounded-lg bg-accent px-3 py-2 text-sm text-foreground">
                {t('msg.approveLoanHint')}{' '}
                <Link to="/loans" className="font-medium text-primary hover:underline">
                  {t('nav.loans')} →
                </Link>
              </p>
            )}
            <label htmlFor="staff-note" className="text-sm font-medium">
              {t('msg.staffNote')}
            </label>
            <Textarea id="staff-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button loading={review.isPending} onClick={() => void submit()}>
              {target?.status === 'Done' ? t('msg.concernMarkHandled') : target?.status === 'Approved' ? t('msg.approve') : t('msg.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
