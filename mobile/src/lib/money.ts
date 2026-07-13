// Port of the desktop's utils/formatters.ts — money is stored in cents.
// "Rs." prefix is deliberately not localized (matches the desktop app).
export function formatCurrency(cents: number): string {
  const rs = cents / 100
  return `Rs. ${rs.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}
