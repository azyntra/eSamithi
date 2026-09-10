import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Briefcase, HandCoins, Heart, IdCard, Landmark, MapPin, Pencil, Phone, ShieldCheck, Smartphone, Trash2, User, UserRound, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage, isApiError } from '@/lib/api/errors'
import { useSession } from '@/lib/api/session'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DeleteMemberDialog } from './components/DeleteMemberDialog'
import { MemberFormSheet } from './components/MemberForm'
import { useMember, useMemberStatement, useSetAppAccess } from './queries'
import { isAppEnabled, isMemberActive, type MemberStatement, type MemberWithDependents } from './types'

import type { MemberTab } from './tabs'
export type { MemberTab }

const GENDER: Record<string, TranslationKey> = { Male: 'mform.male', Female: 'mform.female' }
const MARITAL: Record<string, TranslationKey> = { Single: 'mform.single', Married: 'mform.married', Widowed: 'mform.widowed' }

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('text-right font-medium', mono && 'tnum font-mono')}>{value || '—'}</span>
    </div>
  )
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-primary [&>svg]:size-4">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2.5">{children}</CardContent>
    </Card>
  )
}

export function MemberPage({ memberId, tab }: { memberId: number; tab: MemberTab }) {
  const { t, lang } = useT()
  const navigate = useNavigate({ from: '/members/$memberId' })
  const { user } = useSession()
  const isAdmin = user?.role === 'admin'
  const member = useMember(memberId)
  const effectiveTab: MemberTab = tab === 'app' && !isAdmin ? 'overview' : tab
  const statement = useMemberStatement(memberId, effectiveTab === 'statement')
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const setTab = (next: string) => void navigate({ search: { tab: next === 'overview' ? undefined : (next as MemberTab) }, replace: true })

  if (member.isPending) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-5">
          <Skeleton className="size-20 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (member.isError || !member.data) {
    const notFound = isApiError(member.error) && member.error.status === 404
    return (
      <EmptyState
        icon={<IdCard />}
        title={notFound ? t('members.notFound') : t('common.somethingWrong')}
        description={notFound ? undefined : errorMessage(member.error)}
        action={
          <Button asChild variant="secondary">
            <Link to="/members" search={{ q: undefined, page: undefined, size: undefined }}>
              <ArrowLeft /> {t('members.backToList')}
            </Link>
          </Button>
        }
      />
    )
  }

  const m = member.data
  const initial = (m.full_name || m.society_id || '?').trim().charAt(0).toUpperCase()

  return (
    <>
      <Button asChild variant="link" size="sm" className="mb-3 h-auto px-0 text-muted-foreground">
        <Link to="/members" search={{ q: undefined, page: undefined, size: undefined }}>
          <ArrowLeft /> {t('members.backToList')}
        </Link>
      </Button>

      <header className="mb-6 flex flex-wrap items-center gap-5">
        <div className="bg-brand-gradient grid size-20 shrink-0 place-items-center rounded-full text-3xl font-bold text-white shadow-md">{initial}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{m.full_name || '—'}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="default" className="tnum font-mono">
              #{m.society_id}
            </Badge>
            {m.nic && (
              <Badge variant="outline" className="tnum font-mono">
                <IdCard /> {m.nic}
              </Badge>
            )}
            {isMemberActive(m) ? <Badge variant="success">{t('vmember.activeMember')}</Badge> : <Badge variant="neutral">{t('members.inactive')}</Badge>}
            {m.date_of_joining && <span>{t('members.memberSince', { date: formatDate(m.date_of_joining, lang) })}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void navigate({ to: '/incomes', search: { member: m.id } })}>
            <HandCoins /> {t('vmember.recordPayment')}
          </Button>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil /> {t('members.edit')}
          </Button>
          <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setDeleting(true)} aria-label={t('members.delete')}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <Tabs value={effectiveTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <User /> {t('members.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="statement">
            <HandCoins /> {t('members.tabStatement')}
          </TabsTrigger>
          <TabsTrigger value="dependents">
            <Users /> {t('members.tabDependents')} <span className="tnum ml-1 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{m.dependents.length}</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="app">
              <Smartphone /> {t('members.tabApp')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard icon={<User />} title={t('vmember.personalDetails')}>
              <Row label={t('mform.dob')} value={formatDate(m.date_of_birth, lang)} />
              <Row label={t('mform.gender')} value={m.gender ? (GENDER[m.gender] ? t(GENDER[m.gender]!) : m.gender) : null} />
              <Row label={t('mform.maritalStatus')} value={m.marital_status ? (MARITAL[m.marital_status] ? t(MARITAL[m.marital_status]!) : m.marital_status) : null} />
            </InfoCard>
            <InfoCard icon={<Briefcase />} title={t('vmember.contactWork')}>
              <div className="flex items-start gap-3 text-sm">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="tnum font-medium">{m.phone || '—'}</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{m.occupation || '—'}</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium whitespace-pre-line">{m.address || '—'}</span>
              </div>
            </InfoCard>
            <InfoCard icon={<UserRound />} title={t('mform.familyInfo')}>
              <Row label={t('mform.fatherName')} value={m.father_name} />
              <Row label={t('mform.motherName')} value={m.mother_name} />
              <Row label={t('vmember.fatherInLaw')} value={m.father_in_law_name} />
              <Row label={t('vmember.motherInLaw')} value={m.mother_in_law_name} />
            </InfoCard>
            <InfoCard icon={<Landmark />} title={t('vmember.bankingMembership')}>
              <Row label={t('vmember.bank')} value={m.bank_name} />
              <Row label={t('vmember.accountHolder')} value={m.bank_account_holder_name} />
              <Row label={t('vmember.accountNumber')} value={m.bank_account_number} mono />
              <Row label={t('vmember.dateJoined')} value={formatDate(m.date_of_joining, lang)} />
              <Row label={t('common.status')} value={isMemberActive(m) ? <Badge variant="success">{t('vmember.activeMember')}</Badge> : <Badge variant="neutral">{t('common.inactive')}</Badge>} />
            </InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="statement">
          <StatementTab memberId={memberId} loading={statement.isPending} error={statement.isError ? errorMessage(statement.error) : null} data={statement.data ?? null} onRetry={() => void statement.refetch()} />
        </TabsContent>

        <TabsContent value="dependents">
          {m.dependents.length === 0 ? (
            <EmptyState icon={<Users />} title={t('vmember.noDependentsReg')} action={<Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil /> {t('members.edit')}</Button>} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {m.dependents.map((d) => (
                <Card key={d.id} className="gap-2 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <Heart className="size-4 text-danger" /> {d.name || '—'}
                    </span>
                    <Badge variant="neutral" className="capitalize">
                      {d.relationship || '—'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {d.date_of_birth && <span>{t('vmember.dobShort')}: <span className="text-foreground">{formatDate(d.date_of_birth, lang)}</span></span>}
                    {d.nic && <span>{t('members.nic')}: <span className="font-mono text-foreground">{d.nic}</span></span>}
                    {d.age != null && <span>{t('mform.age')}: <span className="tnum text-foreground">{d.age}</span></span>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="app">
            <AppAccessCard member={m} />
          </TabsContent>
        )}
      </Tabs>

      <MemberFormSheet open={editOpen} onOpenChange={setEditOpen} memberId={memberId} />
      <DeleteMemberDialog member={deleting ? m : null} onOpenChange={(o) => !o && setDeleting(false)} onDeleted={() => void navigate({ to: '/members', search: { q: undefined, page: undefined, size: undefined } })} />
    </>
  )
}

function StatementTab({ loading, error, data, onRetry }: { memberId: number; loading: boolean; error: string | null; data: MemberStatement | null; onRetry: () => void }) {
  const { t, lang } = useT()
  if (error) return <EmptyState title={t('common.somethingWrong')} description={error} action={<Button onClick={onRetry}>{t('common.tryAgain')}</Button>} />
  if (loading || !data) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  const txTable = (rows: Array<{ id: number; date: string; amount: number; status: string; type_name: string }>, tone: 'success' | 'danger') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('common.date')}</TableHead>
          <TableHead>{t('common.type')}</TableHead>
          <TableHead className="text-right">{t('common.amount')}</TableHead>
          <TableHead className="text-center">{t('common.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className={cn(r.status === 'Void' && 'opacity-50 [&_td:nth-child(-n+3)]:line-through')}>
            <TableCell className="tnum whitespace-nowrap">{formatDate(r.date, lang)}</TableCell>
            <TableCell>{r.type_name}</TableCell>
            <TableCell className={cn('tnum text-right font-semibold', tone === 'success' ? 'text-success' : 'text-danger')}>{formatCurrency(r.amount)}</TableCell>
            <TableCell className="text-center">
              <StatusPill value={r.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
  return (
    <div className="grid gap-4">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm">{t('vmember.loans', { count: data.loans.length })}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.loans.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t('vmember.noLoans')}</p>
          ) : (
            data.loans.map((l) => {
              const open = l.status === 'Active' || l.status === 'Overdue'
              return (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <div>
                    <div className="tnum text-sm font-semibold">
                      {formatCurrency(l.principal_amount)} {t('vmember.loanSuffix')}
                      <span className="ml-2 font-normal text-muted-foreground">· {formatDate(l.date_issued, lang)}</span>
                    </div>
                    {open && (
                      <div className="tnum text-xs font-medium text-danger">
                        {t('vmember.outstanding')}: {formatCurrency(l.principal_owed + l.interest_owed + l.fines_owed)}
                      </div>
                    )}
                  </div>
                  <StatusPill value={l.status} />
                </div>
              )
            })
          )}
          {data.guarantees.length > 0 && (
            <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                {t('vmember.guaranteeing', { count: data.guarantees.length })} {data.guarantees.map((g) => g.borrower_name).join(', ')}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm">{t('vmember.paymentsMade', { count: data.income.length })}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">{data.income.length === 0 ? <p className="px-5 text-sm text-muted-foreground italic">{t('vmember.noPayments')}</p> : <div className="max-h-80 overflow-y-auto">{txTable(data.income, 'success')}</div>}</CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm">{t('vmember.benefitsReceived', { count: data.expenses.length })}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">{data.expenses.length === 0 ? <p className="px-5 text-sm text-muted-foreground italic">{t('vmember.noBenefits')}</p> : <div className="max-h-80 overflow-y-auto">{txTable(data.expenses, 'danger')}</div>}</CardContent>
      </Card>
    </div>
  )
}

function AppAccessCard({ member }: { member: MemberWithDependents }) {
  const { t, lang } = useT()
  const setAccess = useSetAppAccess(member.id)
  const [confirm, setConfirm] = useState<'disable' | 'reset' | null>(null)
  const enabled = isAppEnabled(member)
  const apply = async (body: { app_enabled?: 0 | 1; reset_pin?: boolean }) => {
    try {
      await setAccess.mutateAsync(body)
      setConfirm(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  return (
    <>
      <Card className="max-w-2xl gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Smartphone className="size-4 text-primary" /> {t('vmember.appSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Row label={t('vmember.appAccess')} value={enabled ? <Badge variant="success">{t('vmember.appEnabled')}</Badge> : <Badge variant="danger">{t('vmember.appDisabled')}</Badge>} />
          <Row label={t('vmember.appPin')} value={member.pin_set_at ? t('vmember.appPinSet', { date: formatDate(member.pin_set_at, lang) }) : t('vmember.appPinNotSet')} />
          <div className="flex flex-wrap gap-2 pt-1">
            {enabled ? (
              <Button variant="secondary" disabled={setAccess.isPending} onClick={() => setConfirm('disable')}>
                {t('vmember.appDisableBtn')}
              </Button>
            ) : (
              <Button loading={setAccess.isPending} onClick={() => void apply({ app_enabled: 1 })}>
                {t('vmember.appEnableBtn')}
              </Button>
            )}
            {member.pin_set_at && (
              <Button variant="destructive" disabled={setAccess.isPending} onClick={() => setConfirm('reset')}>
                {t('vmember.appResetPin')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        danger
        title={t('vmember.appSection')}
        description={confirm === 'disable' ? t('vmember.appDisableConfirm') : t('vmember.appResetConfirm')}
        busy={setAccess.isPending}
        onConfirm={() => void apply(confirm === 'disable' ? { app_enabled: 0 } : { reset_pin: true })}
      />
    </>
  )
}
