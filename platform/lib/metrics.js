// Shared shape for the console's fleet aggregates. The dashboard and the
// reports both sum the same columns out of tenant_stats_current/_history, so
// the column list and the coercion live here rather than in each route.

// Everything the trend charts can plot. tenant_stats_history carries one row
// per samithi per day, so summing per snapshot_date gives a fleet series.
const TREND_METRICS = [
  'members_total', 'members_active', 'members_enrolled', 'push_tokens',
  'wallets_total_cents', 'loans_active', 'loans_overdue', 'loans_outstanding_cents',
  'fds_count', 'fds_value_cents', 'pending_requests', 'month_income_cents', 'month_expense_cents'
];

const sumOf = (cols) => cols.map((c) => `IFNULL(SUM(${c}),0) AS ${c}`).join(', ');

// mysql2 hands BIGINT sums back as strings; the console does arithmetic on them.
function numeric(row, skip = []) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = skip.includes(k) ? v : Number(v);
  return out;
}

module.exports = { TREND_METRICS, sumOf, numeric };
