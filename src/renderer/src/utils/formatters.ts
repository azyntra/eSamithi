export function formatCurrency(cents: number): string {
  const rs = cents / 100
  // "Rs." to match every input label — Intl's LKR style rendered "LKR"
  return `Rs. ${rs.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function parseCurrency(value: string): number {
  const num = parseFloat(value.replace(/[^0-9.-]+/g, ''))
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}
