const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

// Metrics collector (super-admin panel §4.3). Pulls /internal/stats from each
// samithi's API and upserts tenant_stats_current. Runs hourly + on demand.
// Parallel with a per-tenant timeout so one dead samithi never blocks the sweep.
function internalToken() {
  return jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '30s' });
}

// Counters added to /internal/stats after the collector shipped: a tenant API
// that hasn't been redeployed yet omits them, so treat missing as 0 rather
// than writing NULL over a good column.
const n = (v) => Number(v ?? 0);

// One row per samithi per day: re-running the sweep overwrites the same day,
// so the history keeps each day's latest reading and grows predictably.
// History is secondary telemetry — see the call site: a failure here must not
// make a reachable samithi look down.
async function recordHistory(slug, s) {
  await getPool().query(
    `INSERT INTO tenant_stats_history
      (samithi_slug, snapshot_date, reachable, members_total, members_active, members_enrolled,
       staff_users, wallets_total_cents, loans_active, loans_overdue, loans_outstanding_cents,
       fds_count, fds_value_cents, pending_requests, push_tokens, locked_pins,
       month_income_cents, month_expense_cents)
     VALUES (?, CURDATE(), 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       captured_at = NOW(), reachable = 1,
       members_total = VALUES(members_total), members_active = VALUES(members_active),
       members_enrolled = VALUES(members_enrolled), staff_users = VALUES(staff_users),
       wallets_total_cents = VALUES(wallets_total_cents), loans_active = VALUES(loans_active),
       loans_overdue = VALUES(loans_overdue), loans_outstanding_cents = VALUES(loans_outstanding_cents),
       fds_count = VALUES(fds_count), fds_value_cents = VALUES(fds_value_cents),
       pending_requests = VALUES(pending_requests), push_tokens = VALUES(push_tokens),
       locked_pins = VALUES(locked_pins), month_income_cents = VALUES(month_income_cents),
       month_expense_cents = VALUES(month_expense_cents)`,
    [slug, n(s.members_total), n(s.members_active), n(s.members_enrolled), n(s.staff_users),
     n(s.wallets_total_cents), n(s.loans_active), n(s.loans_overdue), n(s.loans_outstanding_cents),
     n(s.fds_count), n(s.fds_value_cents), n(s.pending_requests), n(s.push_tokens),
     n(s.locked_pins), n(s.month_income_cents), n(s.month_expense_cents)]
  );
}

async function pullOne(samithi) {
  const url = `${samithi.api_url}/internal/stats`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${internalToken()}`, 'X-Samithi': samithi.slug },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    await getPool().query(
      `INSERT INTO tenant_stats_current
        (samithi_slug, reachable, members_total, members_active, members_enrolled, staff_users,
         wallets_total_cents, loans_active, loans_outstanding_cents, fds_count, fds_value_cents,
         pending_requests, last_txn_at, migration_version,
         loans_overdue, push_tokens, locked_pins, month_income_cents, month_expense_cents)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         captured_at = NOW(), reachable = 1,
         members_total = VALUES(members_total), members_active = VALUES(members_active),
         members_enrolled = VALUES(members_enrolled), staff_users = VALUES(staff_users),
         wallets_total_cents = VALUES(wallets_total_cents), loans_active = VALUES(loans_active),
         loans_outstanding_cents = VALUES(loans_outstanding_cents), fds_count = VALUES(fds_count),
         fds_value_cents = VALUES(fds_value_cents), pending_requests = VALUES(pending_requests),
         last_txn_at = VALUES(last_txn_at), migration_version = VALUES(migration_version),
         loans_overdue = VALUES(loans_overdue), push_tokens = VALUES(push_tokens),
         locked_pins = VALUES(locked_pins), month_income_cents = VALUES(month_income_cents),
         month_expense_cents = VALUES(month_expense_cents)`,
      [samithi.slug, s.members_total, s.members_active, s.members_enrolled, s.staff_users,
       s.wallets_total_cents, s.loans_active, s.loans_outstanding_cents, s.fds_count, s.fds_value_cents,
       s.pending_requests, s.last_txn_at, s.migration_version,
       n(s.loans_overdue), n(s.push_tokens), n(s.locked_pins), n(s.month_income_cents), n(s.month_expense_cents)]
    );
    // The live counters are already saved; trend history is a bonus on top.
    // Never let it downgrade the samithi to "unreachable".
    await recordHistory(samithi.slug, s).catch((e) =>
      console.error(`[collector] history write failed for ${samithi.slug}:`, e.message));
    return { slug: samithi.slug, ok: true };
  } catch (err) {
    await getPool().query(
      `INSERT INTO tenant_stats_current (samithi_slug, reachable) VALUES (?, 0)
       ON DUPLICATE KEY UPDATE reachable = 0, captured_at = NOW()`,
      [samithi.slug]
    ).catch(() => {});
    return { slug: samithi.slug, ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function collectAll() {
  const [rows] = await getPool().query(`
    SELECT s.slug, v.api_url FROM samithis s JOIN servers v ON v.id = s.server_id
    WHERE s.status = 'active'`);
  const results = await Promise.all(rows.map(pullOne));
  // Trends never look back further than a year; drop the tail so the table
  // stays bounded. A failure here must not fail the sweep.
  await getPool()
    .query('DELETE FROM tenant_stats_history WHERE snapshot_date < CURDATE() - INTERVAL 400 DAY')
    .catch((e) => console.error('[collector] history prune failed:', e.message));
  return results;
}

function startCollector() {
  const run = () => collectAll()
    .then((r) => console.log(`[collector] swept ${r.length} samithis (${r.filter((x) => x.ok).length} ok)`))
    .catch((e) => console.error('[collector] sweep failed:', e.message));
  setTimeout(run, 5000);          // initial after boot
  setInterval(run, 60 * 60 * 1000); // hourly (FR-2.1)
}

module.exports = { collectAll, startCollector };
