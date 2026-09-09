// Money travels as integer cents; "Rs." matches every label and receipt.
export function formatCurrency(cents: number | null | undefined): string {
  const rs = (Number(cents) || 0) / 100
  return `Rs. ${rs.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Compact form for KPI cards: Rs. 1.2M / 350K; falls back to the full form
export function formatCurrencyCompact(cents: number | null | undefined): string {
  const rs = (Number(cents) || 0) / 100
  const abs = Math.abs(rs)
  if (abs >= 1_000_000) return `Rs. ${(rs / 1_000_000).toLocaleString('en-LK', { maximumFractionDigits: 2 })}M`
  if (abs >= 100_000) return `Rs. ${(rs / 1_000).toLocaleString('en-LK', { maximumFractionDigits: 0 })}K`
  return formatCurrency(cents)
}

// "Rs. 1,000.50" → 100050. Strips the currency label (and its dot) before
// the numeric parse — the desktop's version turned "Rs. 1,000" into 10 cents.
export function parseCurrency(value: string): number {
  const cleaned = String(value)
    .replace(/[A-Za-z]+\.?/g, '')
    .replace(/[^0-9.-]+/g, '')
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return 0
  return Math.round(num * 100)
}

export function formatNumber(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('en-LK')
}
