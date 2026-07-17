import React, { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { api, downloadCsv, pct } from '../../api'
import { ChartCard, Skeleton, useToast } from '../../components/ui'

export interface AdoptRow {
  slug: string; name_en: string; status: string; reachable: number | null; captured_at: string | null
  members_total: number; members_active: number; members_enrolled: number
  push_tokens: number; locked_pins: number
}
export interface Adoption {
  rows: AdoptRow[]
  totals: { members_total: number; members_active: number; members_enrolled: number; push_tokens: number; locked_pins: number }
  as_of: string | null
}

export default function Adoption({ onData }: { onData: (a: Adoption | null) => void }): React.ReactElement {
  const toast = useToast()
  const [data, setData] = useState<Adoption | null>(null)

  useEffect(() => {
    api<Adoption>('/reports/adoption')
      .then((a) => { setData(a); onData(a) })
      .catch((e) => toast('error', (e as Error).message))
  }, [onData, toast])

  // Percentages, not raw counts: a 40-member society and a 400-member one are
  // otherwise impossible to compare on one axis.
  const chartData = (data?.rows ?? [])
    .filter((r) => r.members_total > 0)
    .map((r) => ({
      name: r.name_en,
      enrolled: pct(r.members_enrolled, r.members_total),
      push: pct(r.push_tokens, r.members_total)
    }))
    .sort((a, b) => b.enrolled - a.enrolled)

  const t = data?.totals

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <ChartCard
          title="App reach by samithi (% of members)"
          height={Math.max(220, chartData.length * 44 + 60)}
          empty={chartData.length === 0 ? { title: 'No membership data yet' } : null}
        >
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 22, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} tickFormatter={(v: number) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--chart-cursor)' }}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}
              formatter={(v, name) => [`${Number(v)}%`, name as string]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="enrolled" name="App enrolled" fill="var(--chart-3)" radius={[0, 3, 3, 0]} barSize={11} isAnimationActive={false} />
            <Bar dataKey="push" name="Push reach" fill="var(--chart-1)" radius={[0, 3, 3, 0]} barSize={11} isAnimationActive={false} />
          </BarChart>
        </ChartCard>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 style={{ flex: 1 }}>App adoption</h3>
          <span className="sub">{t ? `${pct(t.members_enrolled, t.members_total)}% enrolled fleet-wide` : ''}</span>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Samithi</th><th>Members</th><th>Enrolled</th><th>Enrolled %</th>
                <th>Push reach</th><th>Push %</th><th>PIN lockouts</th>
              </tr>
            </thead>
            <tbody>
              {!data ? Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={7}><Skeleton h={20} /></td></tr>)
                : data.rows.map((r) => (
                  <tr key={r.slug}>
                    <td>
                      <div className="t-strong row" style={{ gap: 6 }}>
                        {r.name_en}{r.reachable === 0 && <WifiOff size={12} color="var(--warning)" />}
                      </div>
                      <div className="t-mut mono" style={{ fontSize: 12 }}>{r.slug}</div>
                    </td>
                    <td>{r.members_total}</td>
                    <td>{r.members_enrolled}</td>
                    <td><span className="badge neutral">{pct(r.members_enrolled, r.members_total)}%</span></td>
                    <td>{r.push_tokens}</td>
                    <td><span className="badge neutral">{pct(r.push_tokens, r.members_total)}%</span></td>
                    <td>{r.locked_pins ? <span className="badge warn">{r.locked_pins}</span> : <span className="t-mut">—</span>}</td>
                  </tr>
                ))}
            </tbody>
            {t && data && data.rows.length > 0 && (
              <tfoot><tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td>Fleet total</td>
                <td>{t.members_total}</td>
                <td>{t.members_enrolled}</td>
                <td>{pct(t.members_enrolled, t.members_total)}%</td>
                <td>{t.push_tokens}</td>
                <td>{pct(t.push_tokens, t.members_total)}%</td>
                <td>{t.locked_pins}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}

export function downloadAdoption(a: Adoption): void {
  downloadCsv(
    'esamithi-app-adoption',
    ['Samithi', 'Slug', 'Members', 'Active', 'App enrolled', 'Enrolled %', 'Push reach', 'Push %', 'PIN lockouts'],
    a.rows.map((r) => [r.name_en, r.slug, r.members_total, r.members_active, r.members_enrolled,
      pct(r.members_enrolled, r.members_total), r.push_tokens, pct(r.push_tokens, r.members_total), r.locked_pins])
  )
}
