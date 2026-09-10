import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Download, Pencil, Plus, RotateCcw, Save, Shield, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Field } from '@/components/form/Field'
import { PageHeader } from '@/components/PageHeader'
import { RupeeInput, centsToRupees, rupeesToCents } from '@/components/RupeeInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { errorMessage } from '@/lib/api/errors'
import { apiBase, clearSamithi } from '@/lib/api/samithi'
import { forgetSamithi, useSession } from '@/lib/api/session'
import { formatCurrency } from '@/lib/format/currency'
import { useT } from '@/lib/i18n'
import type { ExpenseType, IncomeType, SystemUser } from './api'
import { SecurityTab } from './components/SecurityTab'
import { TypeDialog } from './components/TypeDialog'
import { AddUserDialog, ResetPasswordDialog } from './components/UserDialogs'
import { useDeleteExpenseType, useDeleteIncomeType, useDeleteUser, useExpenseTypes, useIncomeTypes, useSaveExpenseType, useSaveIncomeType, useSettings, useSystemUsers, useUpdateSettings } from './queries'

export const SETTINGS_TABS = ['general', 'loans', 'income', 'expense', 'users', 'security', 'about'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

export function SettingsPage({ tab, onTabChange }: { tab: SettingsTab; onTabChange: (tab: SettingsTab) => void }) {
  const { t } = useT()
  const { user, samithi } = useSession()
  const isAdmin = user?.role === 'admin'
  const settings = useSettings()
  const incomeTypes = useIncomeTypes()
  const expenseTypes = useExpenseTypes()
  const users = useSystemUsers(tab === 'users' && isAdmin)
  const update = useUpdateSettings()
  const saveIncome = useSaveIncomeType()
  const saveExpense = useSaveExpenseType()
  const deleteIncome = useDeleteIncomeType()
  const deleteExpense = useDeleteExpenseType()
  const deleteUser = useDeleteUser()

  const [form, setForm] = useState<Record<string, string>>({})
  const [incomeTarget, setIncomeTarget] = useState<IncomeType | null | undefined>(undefined)
  const [expenseTarget, setExpenseTarget] = useState<ExpenseType | null | undefined>(undefined)
  const [addUser, setAddUser] = useState(false)
  const [resetTarget, setResetTarget] = useState<SystemUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null)
  const [deletingType, setDeletingType] = useState<{ kind: 'income' | 'expense'; row: IncomeType | ExpenseType } | null>(null)
  const [changeSamithi, setChangeSamithi] = useState(false)

  useEffect(() => {
    if (settings.data) setForm(settings.data)
  }, [settings.data])

  const apiVersion = useQuery({ queryKey: ['health'], queryFn: () => fetch(`${apiBase()}/health`).then((r) => r.json() as Promise<{ api_version?: string }>), staleTime: 5 * 60_000, retry: false })

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await update.mutateAsync(form)
      toast.success(t('settings.saved'))
    } catch (err) {
      toast.error(errorMessage(err, t('settings.saveFailed')))
    }
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ timestamp: new Date().toISOString(), settings: form, version: __APP_VERSION__ }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `esamithi_backup_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(t('settings.backupExported'))
  }

  const reactivate = async (kind: 'income' | 'expense', row: IncomeType | ExpenseType) => {
    try {
      if (kind === 'income') await saveIncome.mutateAsync({ id: row.id, payload: { is_active: 1 } })
      else await saveExpense.mutateAsync({ id: row.id, payload: { is_active: 1 } })
      toast.success(t('settings.typeReactivated', { name: row.name }))
    } catch (e) {
      toast.error(errorMessage(e, t('settings.updateFailed')))
    }
  }

  const maxLoanRupees = useMemo(() => (form.max_loan_limit === undefined || form.max_loan_limit === '' ? '' : centsToRupees(Number(form.max_loan_limit))), [form.max_loan_limit])

  const typeRows = (kind: 'income' | 'expense') => {
    const list = kind === 'income' ? (incomeTypes.data ?? []) : (expenseTypes.data ?? [])
    const pending = kind === 'income' ? incomeTypes.isPending : expenseTypes.isPending
    return (
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">{kind === 'income' ? t('settings.tabIncome') : t('settings.tabExpense')}</div>
            <div className="text-xs text-muted-foreground">{kind === 'income' ? t('settings.incomeTypesDesc') : t('settings.expenseTypesDesc')}</div>
          </div>
          <Button size="sm" onClick={() => (kind === 'income' ? setIncomeTarget(null) : setExpenseTarget(null))}>
            <Plus /> {t('settings.addType')}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              {kind === 'income' && <TableHead>{t('settings.categoryGroup')}</TableHead>}
              <TableHead className="text-right">{kind === 'income' ? t('settings.defaultAmount') : t('settings.standardPayout')}</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">{t('common.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  {kind === 'income' ? t('settings.noIncomeTypes') : t('settings.noExpenseTypes')}
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => {
                const inactive = Number(row.is_active) === 0
                const amount = 'standard_amount' in row ? row.standard_amount : row.standard_payout
                return (
                  <TableRow key={row.id} className={inactive ? 'opacity-60' : undefined}>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                      {inactive && (
                        <Badge variant="neutral" className="ml-2">
                          {t('common.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    {kind === 'income' && (
                      <TableCell>
                        <Badge variant="default">{(row as IncomeType).category_group}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="tnum text-right">{formatCurrency(amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`${t('common.edit')}: ${row.name}`} onClick={() => (kind === 'income' ? setIncomeTarget(row as IncomeType) : setExpenseTarget(row as ExpenseType))}>
                              <Pencil />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('common.edit')}</TooltipContent>
                        </Tooltip>
                        {inactive && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="text-success hover:bg-success-soft hover:text-success" aria-label={`${t('settings.reactivate')}: ${row.name}`} onClick={() => void reactivate(kind, row)}>
                                <RotateCcw />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('settings.reactivate')}</TooltipContent>
                          </Tooltip>
                        )}
                        {row.code ? (
                          <Badge variant="neutral" title={t('settings.systemHint')}>
                            {t('settings.system')}
                          </Badge>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`${t('common.delete')}: ${row.name}`} onClick={() => setDeletingType({ kind, row })}>
                                <Trash2 />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('common.delete')}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
        actions={
          <Button variant="secondary" onClick={exportBackup}>
            <Download /> {t('settings.exportBackup')}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as SettingsTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">{t('settings.tabGeneral')}</TabsTrigger>
          <TabsTrigger value="loans">{t('settings.tabLoans')}</TabsTrigger>
          <TabsTrigger value="income">{t('settings.tabIncome')}</TabsTrigger>
          <TabsTrigger value="expense">{t('settings.tabExpense')}</TabsTrigger>
          <TabsTrigger value="users">{t('settings.tabSystem')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.tabSecurity')}</TabsTrigger>
          <TabsTrigger value="about">{t('settings.tabAbout')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="max-w-3xl gap-4">
            <CardHeader>
              <CardTitle className="text-sm">{t('settings.generalTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('settings.generalDesc')}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="grid gap-4">
                <Field label={t('settings.societyName')} required>
                  {({ id }) => <Input id={id} value={form.society_name ?? ''} onChange={(e) => set('society_name', e.target.value)} />}
                </Field>
                <Field label={t('settings.lowWalletThreshold')}>
                  {({ id }) => <Input id={id} type="number" inputMode="numeric" className="tnum" value={form.low_wallet_threshold ?? ''} onChange={(e) => set('low_wallet_threshold', e.target.value)} />}
                </Field>
                <Field label={t('settings.dashboardRange')}>
                  {({ id }) => (
                    <NativeSelect id={id} value={form.dashboard_date_range ?? 'current_month'} onChange={(e) => set('dashboard_date_range', e.target.value)}>
                      <option value="current_month">{t('settings.currentMonth')}</option>
                      <option value="current_quarter">{t('settings.currentQuarter')}</option>
                      <option value="current_year">{t('settings.currentYear')}</option>
                    </NativeSelect>
                  )}
                </Field>
                <div>
                  <Button type="submit" loading={update.isPending}>
                    <Save /> {t('settings.saveSettings')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card className="max-w-3xl gap-4">
            <CardHeader>
              <CardTitle className="text-sm">{t('settings.loanEngineTitle')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('settings.loanEngineDesc')}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
                <Field label={t('settings.gracePeriod')}>
                  {({ id }) => <Input id={id} type="number" min="0" inputMode="numeric" className="tnum" value={form.grace_period_days ?? ''} onChange={(e) => set('grace_period_days', e.target.value)} />}
                </Field>
                <Field label={t('settings.monthlyInterest')}>
                  {({ id }) => <Input id={id} type="number" step="0.1" inputMode="decimal" className="tnum" value={form.monthly_interest_rate ?? ''} onChange={(e) => set('monthly_interest_rate', e.target.value)} />}
                </Field>
                <Field label={t('settings.lateFine')}>
                  {({ id }) => <Input id={id} type="number" step="0.1" inputMode="decimal" className="tnum" value={form.late_fine_rate ?? ''} onChange={(e) => set('late_fine_rate', e.target.value)} />}
                </Field>
                <Field label={t('settings.maxLoanLimit')} description={t('settings.currently', { value: form.max_loan_limit ? formatCurrency(Number(form.max_loan_limit)) : '—' })}>
                  {({ id, describedBy }) => <RupeeInput id={id} aria-describedby={describedBy} value={maxLoanRupees} onChange={(v) => set('max_loan_limit', v === '' ? '' : String(rupeesToCents(v)))} />}
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" loading={update.isPending}>
                    <Save /> {t('settings.saveSettings')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">{typeRows('income')}</TabsContent>
        <TabsContent value="expense">{typeRows('expense')}</TabsContent>

        <TabsContent value="users">
          {!isAdmin ? (
            <EmptyState icon={<AlertCircle />} title={t('settings.onlyAdmins')} />
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{t('settings.tabSystem')}</div>
                  <div className="text-xs text-muted-foreground">{t('settings.systemUsersDesc')}</div>
                </div>
                <Button size="sm" onClick={() => setAddUser(true)}>
                  <UserPlus /> {t('settings.addUser')}
                </Button>
              </div>
              <div className="grid gap-2 p-4">
                {users.isPending ? (
                  <>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </>
                ) : (
                  (users.data ?? []).map((su) => (
                    <div key={su.id} data-user={su.username} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="bg-brand-gradient grid size-9 place-items-center rounded-full text-sm font-bold text-white">{su.full_name.charAt(0).toUpperCase()}</span>
                        <div className="leading-tight">
                          <div className="font-medium">{su.full_name}</div>
                          <div className="text-xs text-muted-foreground">@{su.username}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={su.role === 'admin' ? 'brand' : su.role === 'viewer' ? 'neutral' : 'default'} className="gap-1">
                          {su.role === 'admin' ? <ShieldCheck /> : <Shield />}
                          {su.role === 'admin' ? t('settings.roleAdmin') : su.role === 'viewer' ? t('role.viewer') : t('settings.roleUser')}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => setResetTarget(su)}>
                          {t('settings.resetPassword')}
                        </Button>
                        {su.id !== user?.id && (
                          <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`${t('settings.deleteUserTooltip')}: ${su.full_name}`} onClick={() => setDeletingUser(su)}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="about">
          <div className="grid max-w-3xl gap-4">
            <Card className="gap-3">
              <CardContent className="flex items-center gap-4">
                <BrandMark size={56} />
                <div>
                  <h3 className="text-lg font-semibold">eSamithi</h3>
                  <p className="text-sm text-muted-foreground">{t('login.platform')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="default" className="tnum">
                      {t('settings.webVersion')} {__APP_VERSION__}
                    </Badge>
                    {apiVersion.data?.api_version && (
                      <Badge variant="outline" className="tnum">
                        {t('settings.apiVersion')} {apiVersion.data.api_version}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-sm">{t('settings.samithiWeb')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="text-sm">
                  <span className="font-medium">{samithi?.name ?? '—'}</span>
                  {samithi?.code && <span className="tnum ml-2 font-mono text-muted-foreground">{samithi.code}</span>}
                </div>
                <div>
                  <Button variant="secondary" onClick={() => setChangeSamithi(true)}>
                    {t('settings.changeSamithiWeb')}
                  </Button>
                </div>
                <p className="text-xs text-subtle-foreground">{t('settings.changeSamithiWarn')}</p>
              </CardContent>
            </Card>

            <Card className="gap-3">
              <CardHeader>
                <CardTitle className="text-sm">{t('settings.webUpdates')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('settings.webUpdatesBody')}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <TypeDialog kind="income" type={incomeTarget} onOpenChange={(o) => !o && setIncomeTarget(undefined)} />
      <TypeDialog kind="expense" type={expenseTarget} onOpenChange={(o) => !o && setExpenseTarget(undefined)} />
      <AddUserDialog open={addUser} onOpenChange={setAddUser} />
      <ResetPasswordDialog user={resetTarget} onOpenChange={(o) => !o && setResetTarget(null)} />

      <ConfirmDialog
        open={deletingUser !== null}
        onOpenChange={(o) => !o && setDeletingUser(null)}
        danger
        title={t('settings.deleteUserTitle')}
        description={t('settings.deleteUserMsg', { name: deletingUser?.full_name ?? '', username: deletingUser?.username ?? '' })}
        confirmLabel={t('settings.deleteUserLabel')}
        busy={deleteUser.isPending}
        onConfirm={async () => {
          if (!deletingUser) return
          try {
            await deleteUser.mutateAsync(deletingUser.id)
            toast.success(t('settings.userDeleted', { name: deletingUser.full_name }))
            setDeletingUser(null)
          } catch (e) {
            toast.error(errorMessage(e, t('settings.userDeleteFailed')))
          }
        }}
      />

      <ConfirmDialog
        open={deletingType !== null}
        onOpenChange={(o) => !o && setDeletingType(null)}
        danger
        title={deletingType?.kind === 'expense' ? t('settings.deleteExpenseTypeTitle') : t('settings.deleteIncomeTypeTitle')}
        description={deletingType ? t(deletingType.kind === 'expense' ? 'settings.deleteExpenseTypeMsg' : 'settings.deleteIncomeTypeMsg', { name: deletingType.row.name }) : ''}
        confirmLabel={t('settings.deleteTypeLabel')}
        busy={deleteIncome.isPending || deleteExpense.isPending}
        onConfirm={async () => {
          if (!deletingType) return
          try {
            const r = deletingType.kind === 'income' ? await deleteIncome.mutateAsync(deletingType.row.id) : await deleteExpense.mutateAsync(deletingType.row.id)
            toast.success(r.deactivated ? t('settings.typeDeactivated', { name: deletingType.row.name }) : deletingType.kind === 'income' ? t('settings.incomeTypeDeleted') : t('settings.expenseTypeDeleted'))
            setDeletingType(null)
          } catch (e) {
            toast.error(errorMessage(e, t('settings.deleteFailed')))
          }
        }}
      />

      <ConfirmDialog
        open={changeSamithi}
        onOpenChange={setChangeSamithi}
        title={t('settings.changeSamithiWeb')}
        description={t('settings.changeSamithiWarn')}
        confirmLabel={t('settings.changeSamithiWeb')}
        onConfirm={() => {
          clearSamithi()
          forgetSamithi()
          window.location.assign(`${import.meta.env.BASE_URL}login`)
        }}
      />
    </>
  )
}
