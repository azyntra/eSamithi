import React, { useCallback, useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { api, downloadCsv, rs, rsShort } from '../../api'
import { ChartCard, Segmented, useToast } from '../../components/ui'

export interface TrendPoint {
  date: string
  members_total: number; members_active: number; members_enrolled: number; push_tokens: number
  wallets_total_cents: number; loans_active: number; loans_overdue: number
  loans_outstanding_cents: number; fds_count: number; fds_value_cents: number
  pending_requests: number; month_income_cents: number; month_expense_cents: number
}
interface SamithiOpt { slug: string; name_en: string; status: string }

type Family = 'membership' | 'money' | 'cashflow'
const FAMILIES: { value: Family; label: string }[] = [
  { value: 'membership', label: 'Membership' },
  { value: 'money', label: 'Funds & loans' },
  { value: 'cashflow', label: 'Monthly cashflow' }
]
// Each family plots a few related series on one axis, so the lines stay comparable.
const SERIES: Record<Family, { key: keyof TrendPoint; label: string; color: string }[]> = {
  membership: [
    { key: 'members_total', label: 'Members', color: 'var(--chart-1)' },
    { key: 'members_enrolled', label: 'App enrolled', color: 'var(--chart-3)' },
    { key: 'push_tokens', label: 'Push reach', color: 'var(--chart-5)' }
  ],
  money: [
    { key: 'wallets_total_cents', label: 'Wallets', color: 'var(--chart-2)' },
    { key: 'loans_outstanding_cents', label: 'Loans outstanding', color: 'var(--chart-4)' },
    { key: 'fds_value_cents', label: 'Fixed deposits', color: 'var(--chart-3)' }
  ],
  cashflow: [
    { key: 'month_income_cents', label: 'Income (month to date)', color: 'var(--chart-2)' },
    { key: 'month_expense_cents', label: 'Expenses (month to date)', color: 'var(--chart-4)' }
  ]
}
const isMoney = (f: Family): boolean => f !== 'membership'

export default function Trends({ onData }: { onData: (rows: TrendPoint[] | null, family: Family) => void }): React.ReactElement {
  const toast = useToast()
  const [series, setSeries] = useState<TrendPoint[] | null>(null)
  const [samithis, setSamithis] = useState<SamithiOpt[]>([])
  const [days, setDays] = useState('90')
  const [slug, setSlug] = useState('')
  const [family, setFamily] = useState<Family>('membership')

  useEffect(() => {
    api<SamithiOpt[]>('/samithis').then((r) => setSamithis(r.filter((s) => s.status !== 'archived'))).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    const qs = `days=${days}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`
    const r = await api<{ series: TrendPoint[] }>(`/reports/trends?${qs}`)
    setSeries(r.series)
    onData(r.series, family)
  }, [days, slug, family, onData])

  useEffect(() => { load().catch((e) => toast('error', (e as Error).message)) }, [load, toast])

  const money = isMoney(family)
  const lines = SERIES[family]
  const enough = (series?.length ?? 0) > 1

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <Segmented value={family} onChange={setFamily} options={FAMILIES} />
        <select className="select" style={{ width: 'auto' }} value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">Whole fleet</option>
          {samithis.map((s) => <option key={s.slug} value={s.slug}>{s.name_en}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 180 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      <ChartCard
        title={slug ? `Trend · ${samithis.find((s) => s.slug === slug)?.name_en ?? slug}` : 'Fleet trend'}
        height={340}
        empty={enough ? null : {
          title: 'Not enough history yet',
          hint: 'The collector records one snapshot per day. Trends appear once at least two days exist.'
        }}
      >
        <LineChart data={series ?? []} margin={{ top: 6, right: 18, bottom: 0, left: 6 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }} tickFormatter={(v: string) => String(v).slice(5)} minTickGap={26} />
          {/* Auto domain: these series are compared against each other, not
              against zero, and a 0-anchored axis flattens real movement. */}
          <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} tickLine={false} axisLine={false}
            domain={['auto', 'auto']} width={money ? 72 : 46} tickFormatter={(v: number) => (money ? rsShort(v) : String(v))} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}
            formatter={(v, name) => [money ? rs(Number(v)) : Number(v).toLocaleString(), name as string]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => (
            <Line key={String(l.key)} type="monotone" dataKey={l.key as string} name={l.label}
              stroke={l.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ChartCard>
    </>
  )
}

export function downloadTrends(series: TrendPoint[], family: Family): void {
  const lines = SERIES[family]
  const money = isMoney(family)
  const headers = ['Date', ...lines.map((l) => (money ? `${l.label} (Rs)` : l.label))]
  const body = series.map((p) => [
    p.date,
    ...lines.map((l) => (money ? (Number(p[l.key]) / 100).toFixed(2) : Number(p[l.key])))
  ])
  downloadCsv(`esamithi-trends-${family}`, headers, body)
}
