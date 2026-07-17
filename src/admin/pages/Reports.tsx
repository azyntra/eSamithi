import React, { useCallback, useState } from 'react'
import { Download, RefreshCcw, Printer, BarChart3, LineChart, Smartphone, AlarmClock } from 'lucide-react'
import { api, exportPdf, timeAgo } from '../api'
import { Button, PrintLetterhead, Tabs, useToast } from '../components/ui'
import Comparison, { downloadComparison, type Comparison as Comp } from './reports/Comparison'
import Trends, { downloadTrends, type TrendPoint } from './reports/Trends'
import Adoption, { downloadAdoption, type Adoption as Adopt } from './reports/Adoption'
import Inactivity, { downloadInactivity, type InactRow } from './reports/Inactivity'

type Tab = 'comparison' | 'trends' | 'adoption' | 'inactivity'
const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'comparison', label: 'Comparison', icon: <BarChart3 size={14} /> },
  { value: 'trends', label: 'Trends', icon: <LineChart size={14} /> },
  { value: 'adoption', label: 'App adoption', icon: <Smartphone size={14} /> },
  { value: 'inactivity', label: 'Inactivity', icon: <AlarmClock size={14} /> }
]
const TITLES: Record<Tab, string> = {
  comparison: 'Fleet comparison',
  trends: 'Fleet trends',
  adoption: 'App adoption',
  inactivity: 'Inactivity report'
}

// Each tab hands its loaded rows up here so the shared Export buttons can act
// on whatever is currently on screen.
interface Loaded {
  comparison: Comp | null
  trends: { rows: TrendPoint[] | null; family: 'membership' | 'money' | 'cashflow' }
  adoption: Adopt | null
  inactivity: { rows: InactRow[] | null; days: number }
}

export default function Reports(): React.ReactElement {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('comparison')
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [loaded, setLoaded] = useState<Loaded>({
    comparison: null,
    trends: { rows: null, family: 'membership' },
    adoption: null,
    inactivity: { rows: null, days: 30 }
  })

  const onComparison = useCallback((c: Comp | null) => setLoaded((l) => ({ ...l, comparison: c })), [])
  const onTrends = useCallback((rows: TrendPoint[] | null, family: 'membership' | 'money' | 'cashflow') =>
    setLoaded((l) => ({ ...l, trends: { rows, family } })), [])
  const onAdoption = useCallback((a: Adopt | null) => setLoaded((l) => ({ ...l, adoption: a })), [])
  const onInactivity = useCallback((rows: InactRow[] | null, days: number) =>
    setLoaded((l) => ({ ...l, inactivity: { rows, days } })), [])

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await api('/dashboard/refresh', { method: 'POST' })
      setNonce((n) => n + 1) // remount the active tab so it refetches
      toast('success', 'Snapshots refreshed')
    } catch (e) { toast('error', (e as Error).message) }
    finally { setRefreshing(false) }
  }

  const csv = (): void => {
    if (tab === 'comparison' && loaded.comparison) return downloadComparison(loaded.comparison)
    if (tab === 'trends' && loaded.trends.rows) return downloadTrends(loaded.trends.rows, loaded.trends.family)
    if (tab === 'adoption' && loaded.adoption) return downloadAdoption(loaded.adoption)
    if (tab === 'inactivity' && loaded.inactivity.rows) return downloadInactivity(loaded.inactivity.rows, loaded.inactivity.days)
    toast('info', 'Nothing to export yet')
  }

  const hasRows =
    (tab === 'comparison' && (loaded.comparison?.rows.length ?? 0) > 0) ||
    (tab === 'trends' && (loaded.trends.rows?.length ?? 0) > 0) ||
    (tab === 'adoption' && (loaded.adoption?.rows.length ?? 0) > 0) ||
    (tab === 'inactivity' && (loaded.inactivity.rows?.length ?? 0) > 0)

  const asOf = tab === 'adoption' ? loaded.adoption?.as_of : loaded.comparison?.as_of

  return (
    <>
      <PrintLetterhead title={TITLES[tab]} meta={asOf ? `snapshot ${String(asOf).replace('T', ' ').slice(0, 16)}` : undefined} />

      <div className="row no-print" style={{ marginBottom: 16 }}>
        <span className="t-mut">{asOf ? `Snapshot ${timeAgo(asOf)}` : 'Cached snapshots'}</span>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <Button variant="ghost" loading={refreshing} onClick={refresh}>
            {!refreshing && <RefreshCcw size={14} />} Refresh
          </Button>
          <Button variant="ghost" onClick={exportPdf} disabled={!hasRows}><Printer size={14} /> Export PDF</Button>
          <Button onClick={csv} disabled={!hasRows}><Download size={14} /> Export CSV</Button>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} options={TABS} />

      {tab === 'comparison' && <Comparison key={`c${nonce}`} onData={onComparison} />}
      {tab === 'trends' && <Trends key={`t${nonce}`} onData={onTrends} />}
      {tab === 'adoption' && <Adoption key={`a${nonce}`} onData={onAdoption} />}
      {tab === 'inactivity' && <Inactivity key={`i${nonce}`} onData={onInactivity} />}
    </>
  )
}
