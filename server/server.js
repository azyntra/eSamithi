require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { initPool } = require('./db');

// Route imports
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const membersRoutes = require('./routes/members.routes');
const walletsRoutes = require('./routes/wallets.routes');
const fixedDepositsRoutes = require('./routes/fixedDeposits.routes');
const assetsRoutes = require('./routes/assets.routes');
const settingsRoutes = require('./routes/settings.routes');
const incomeTypesRoutes = require('./routes/incomeTypes.routes');
const expenseTypesRoutes = require('./routes/expenseTypes.routes');
const incomeRoutes = require('./routes/income.routes');
const expensesRoutes = require('./routes/expenses.routes');
const loansRoutes = require('./routes/loans.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reportsRoutes = require('./routes/reports.routes');
// Member mobile app (self-service; token type isolated from staff auth)
const memberAuthRoutes = require('./routes/memberAuth.routes');
const meRoutes = require('./routes/me.routes');
// v2: staff-authored notices + member request review queue
const announcementsRoutes = require('./routes/announcements.routes');
const memberRequestsRoutes = require('./routes/memberRequests.routes');
const eventsRoutes = require('./routes/events.routes');
const purukaRoutes = require('./routes/puruka.routes');
const purukaAdminRoutes = require('./routes/purukaAdmin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('short'));

// Puruka listing photos (filenames are random hex, unguessable). Served under
// /api/v1 so it rides the existing nginx proxy (nginx only forwards /api/ to
// Node); helmet's default Cross-Origin-Resource-Policy would block app image
// loads, so relax it for these static assets.
const path = require('path');
app.use('/api/v1/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', immutable: true }));

// ── Health Check ─────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/members', membersRoutes);
app.use('/api/v1/wallets', walletsRoutes);
app.use('/api/v1/fixed-deposits', fixedDepositsRoutes);
app.use('/api/v1/assets', assetsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/income-types', incomeTypesRoutes);
app.use('/api/v1/expense-types', expenseTypesRoutes);
app.use('/api/v1/income', incomeRoutes);
app.use('/api/v1/expenses', expensesRoutes);
app.use('/api/v1/loans', loansRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/member-auth', memberAuthRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/api/v1/announcements', announcementsRoutes);
app.use('/api/v1/member-requests', memberRequestsRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/puruka', purukaRoutes);
app.use('/api/v1/puruka-admin', purukaAdminRoutes);

// ── Global Error Handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ── Start Server ─────────────────────────────────────────────
async function start() {
  try {
    await initPool();
    console.log('✓ MySQL connection pool ready');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ eSamithi API server running on port ${PORT}`);
    });

    // Puruka pre-expiry reminders (requirement P9.2): push to owners of posts
    // expiring within 3 days, once per post; flag resets on renew.
    const { getPool } = require('./db');
    const { sendPushToMembers } = require('./lib/push');
    const notifyExpiring = async () => {
      try {
        const pool = getPool();
        const [rows] = await pool.query(`
          SELECT id, member_id, title FROM puruka_posts
          WHERE status = 'Active' AND expiry_notified = 0
            AND expires_at <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        `);
        for (const post of rows) {
          await sendPushToMembers(pool, [post.member_id], {
            title: 'පුරුක — ඔබේ දැන්වීම ළඟදීම කල් ඉකුත් වේ',
            body: post.title,
            data: { screen: 'puruka-mine' }
          });
          await pool.query('UPDATE puruka_posts SET expiry_notified = 1 WHERE id = ?', [post.id]);
        }
        if (rows.length > 0) console.log(`[puruka] expiry reminders sent: ${rows.length}`);
      } catch (err) {
        console.error('[puruka] expiry sweep failed:', err.message);
      }
    };
    notifyExpiring();
    setInterval(notifyExpiring, 12 * 60 * 60 * 1000);
  } catch (err) {
    console.error('✗ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
