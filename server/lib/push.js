// Expo push sender — fire-and-forget from the announcement routes and the
// Puruka expiry sweep. A push failure must never fail the API call, so
// everything is wrapped and logged. Uses global fetch (Node 18+).

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

async function sendBatches(pool, messages) {
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch)
      });
      const json = await res.json().catch(() => null);

      // Drop tokens Expo reports as dead so the table stays clean
      const tickets = json && Array.isArray(json.data) ? json.data : [];
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket && ticket.status === 'error' && ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          await pool.query('DELETE FROM member_push_tokens WHERE token = ?', [batch[j].to]).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[push] batch send failed:', err.message);
    }
  }
}

function toMessages(rows, { title, body, data }) {
  return rows.map((r) => ({
    to: r.token,
    sound: 'default',
    title,
    body: body || '',
    data: data || {}
  }));
}

async function sendPushToAllMembers(pool, message) {
  try {
    const [rows] = await pool.query('SELECT token FROM member_push_tokens');
    if (rows.length === 0) return;
    await sendBatches(pool, toMessages(rows, message));
  } catch (err) {
    console.error('[push] send skipped:', err.message);
  }
}

// Targeted send (e.g. "your Puruka post expires soon")
async function sendPushToMembers(pool, memberIds, message) {
  try {
    if (!memberIds || memberIds.length === 0) return;
    const [rows] = await pool.query(
      'SELECT token FROM member_push_tokens WHERE member_id IN (?)',
      [memberIds]
    );
    if (rows.length === 0) return;
    await sendBatches(pool, toMessages(rows, message));
  } catch (err) {
    console.error('[push] targeted send skipped:', err.message);
  }
}

module.exports = { sendPushToAllMembers, sendPushToMembers };
