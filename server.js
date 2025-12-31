// USSS Management Portal - Backend Server
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'usss-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ==================== DATA STORAGE ====================
const RAPORTY_FILE = path.join(__dirname, 'data', 'raporty.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const AUDIT_LOG_FILE = path.join(__dirname, 'data', 'audit.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize files if they don't exist
function initializeFiles() {
  if (!fs.existsSync(RAPORTY_FILE)) {
    fs.writeFileSync(RAPORTY_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(USERS_FILE)) {
    // Default admin user
    const defaultAdmin = {
      id: '1',
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'director',
      displayName: 'Director USSS',
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([defaultAdmin], null, 2));
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
      siteName: 'USSS Management Portal',
      primaryColor: '#c9a227',
      secondaryColor: '#1a1a2e',
      maintenanceMode: false
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  }
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify([], null, 2));
  }
}
initializeFiles();

// Data helpers
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return file.includes('raporty') || file.includes('audit') || file.includes('users') ? [] : {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${file}:`, e);
    return file.includes('raporty') || file.includes('audit') || file.includes('users') ? [] : {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Premium types configuration
const PREMIE = {
  "Obstawa Lobby": 5000,
  "Obstawa Napadu na Biznes/Bank": 5000,
  "Patrol na mieście": 4000,
  "Patrol w frakcjach": 4000,
  "Eventy": 7000,
  "Convoye/Obstawa VIP": 6500,
  "Obstawy rozpraw sądowych": 7000,
  "Craft": 10000,
  "Zatrzymanie": 4000,
  "Napad na Cayo Perico/Fort Zancudo": 6000,
  "Nalot": 13000,
  "Drop": 8000,
  "Listy Gończe": 9000,
  "Wsparcie na mieście (c0)": 4500,
  "Montaż kamer/Obrona Kamer": 4000,
  "Pomoc w rekrutacji": 5000,
  "Szkolenie Agentów": 10000,
  "Udział w Magazynach/Dilerce": 6000
};

// Audit logging
function logAudit(action, userId, details) {
  const logs = readJSON(AUDIT_LOG_FILE);
  logs.push({
    id: Date.now().toString(),
    action,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
  // Keep only last 1000 logs
  if (logs.length > 1000) logs.splice(0, logs.length - 1000);
  writeJSON(AUDIT_LOG_FILE, logs);
}

// ==================== AUTH MIDDLEWARE ====================
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden - insufficient permissions' });
    }
    next();
  };
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.username === username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName
    };

    logAudit('LOGIN', user.id, { username: user.username });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  if (req.session.user) {
    logAudit('LOGOUT', req.session.user.id, { username: req.session.user.username });
  }
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

// ==================== REPORTS API ====================
app.get('/api/reports', requireAuth, (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);
    const { status, userId, search, page = 1, limit = 50 } = req.query;

    let filtered = [...reports];

    if (status && status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }
    if (userId) {
      filtered = filtered.filter(r => r.userId === userId);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.username?.toLowerCase().includes(searchLower) ||
        r.typ?.toLowerCase().includes(searchLower) ||
        r.uid?.includes(search)
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginated = filtered.slice(startIndex, endIndex);

    res.json({
      reports: paginated,
      total: filtered.length,
      page: parseInt(page),
      totalPages: Math.ceil(filtered.length / limit),
      premieTypes: PREMIE
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/reports/:id', requireAuth, (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);
    const report = reports.find(r => r.id === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/reports/:id/status', requireAuth, requireRole('director', 'supervisor'), (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const reports = readJSON(RAPORTY_FILE);
    const index = reports.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const oldStatus = reports[index].status;
    reports[index].status = status;
    reports[index].updatedBy = req.session.user.username;
    reports[index].updatedAt = new Date().toISOString();

    writeJSON(RAPORTY_FILE, reports);

    logAudit('REPORT_STATUS_CHANGE', req.session.user.id, {
      reportId: req.params.id,
      oldStatus,
      newStatus: status,
      username: reports[index].username
    });

    res.json({ success: true, report: reports[index] });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/reports/:id/type', requireAuth, requireRole('director', 'supervisor'), (req, res) => {
  try {
    const { typ } = req.body;
    if (!PREMIE[typ]) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    const reports = readJSON(RAPORTY_FILE);
    const index = reports.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const oldTyp = reports[index].typ;
    reports[index].typ = typ;
    reports[index].kwota = PREMIE[typ];
    reports[index].updatedBy = req.session.user.username;
    reports[index].updatedAt = new Date().toISOString();

    writeJSON(RAPORTY_FILE, reports);

    logAudit('REPORT_TYPE_CHANGE', req.session.user.id, {
      reportId: req.params.id,
      oldTyp,
      newTyp: typ,
      username: reports[index].username
    });

    res.json({ success: true, report: reports[index] });
  } catch (error) {
    console.error('Error updating report type:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk actions
app.post('/api/reports/bulk/accept', requireAuth, requireRole('director', 'supervisor'), (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No report IDs provided' });
    }

    const reports = readJSON(RAPORTY_FILE);
    let updated = 0;

    ids.forEach(id => {
      const index = reports.findIndex(r => r.id === id);
      if (index !== -1 && reports[index].status === 'pending') {
        reports[index].status = 'accepted';
        reports[index].updatedBy = req.session.user.username;
        reports[index].updatedAt = new Date().toISOString();
        updated++;
      }
    });

    writeJSON(RAPORTY_FILE, reports);

    logAudit('BULK_ACCEPT', req.session.user.id, { count: updated, ids });

    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error in bulk accept:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/reports/bulk/reject', requireAuth, requireRole('director', 'supervisor'), (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No report IDs provided' });
    }

    const reports = readJSON(RAPORTY_FILE);
    let updated = 0;

    ids.forEach(id => {
      const index = reports.findIndex(r => r.id === id);
      if (index !== -1 && reports[index].status === 'pending') {
        reports[index].status = 'rejected';
        reports[index].updatedBy = req.session.user.username;
        reports[index].updatedAt = new Date().toISOString();
        updated++;
      }
    });

    writeJSON(RAPORTY_FILE, reports);

    logAudit('BULK_REJECT', req.session.user.id, { count: updated, ids });

    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error in bulk reject:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== STATISTICS API ====================
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);

    // General stats
    const stats = {
      total: reports.length,
      pending: reports.filter(r => r.status === 'pending').length,
      accepted: reports.filter(r => r.status === 'accepted').length,
      rejected: reports.filter(r => r.status === 'rejected').length
    };

    // Total payouts
    const totalPayout = reports
      .filter(r => r.status === 'accepted')
      .reduce((sum, r) => sum + (r.kwota || 0), 0);

    // Reports by type
    const byType = {};
    Object.keys(PREMIE).forEach(type => {
      byType[type] = reports.filter(r => r.typ === type && r.status === 'accepted').length;
    });

    // Top users
    const userPayouts = {};
    reports.filter(r => r.status === 'accepted').forEach(r => {
      if (!userPayouts[r.userId]) {
        userPayouts[r.userId] = { userId: r.userId, username: r.username, uid: r.uid, total: 0, count: 0 };
      }
      userPayouts[r.userId].total += r.kwota || 0;
      userPayouts[r.userId].count++;
    });

    const topUsers = Object.values(userPayouts)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentReports = reports.filter(r => new Date(r.date) >= weekAgo);

    // Daily breakdown
    const dailyStats = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStats[dateStr] = { total: 0, accepted: 0, rejected: 0 };
    }
    recentReports.forEach(r => {
      const dateStr = r.date.split('T')[0];
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].total++;
        if (r.status === 'accepted') dailyStats[dateStr].accepted++;
        if (r.status === 'rejected') dailyStats[dateStr].rejected++;
      }
    });

    res.json({
      stats,
      totalPayout,
      byType,
      topUsers,
      dailyStats,
      premieTypes: PREMIE
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User statistics
app.get('/api/stats/user/:userId', requireAuth, (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);
    const userReports = reports.filter(r => r.userId === req.params.userId);

    if (userReports.length === 0) {
      return res.status(404).json({ error: 'User not found or has no reports' });
    }

    const stats = {
      total: userReports.length,
      pending: userReports.filter(r => r.status === 'pending').length,
      accepted: userReports.filter(r => r.status === 'accepted').length,
      rejected: userReports.filter(r => r.status === 'rejected').length
    };

    const totalPayout = userReports
      .filter(r => r.status === 'accepted')
      .reduce((sum, r) => sum + (r.kwota || 0), 0);

    const byType = {};
    Object.keys(PREMIE).forEach(type => {
      byType[type] = userReports.filter(r => r.typ === type && r.status === 'accepted').length;
    });

    res.json({
      userId: req.params.userId,
      username: userReports[0]?.username || 'Unknown',
      uid: userReports[0]?.uid || null,
      stats,
      totalPayout,
      byType
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Payouts export
app.get('/api/payouts', requireAuth, (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);
    const payouts = {};

    reports.filter(r => r.status === 'accepted').forEach(r => {
      if (!payouts[r.userId]) {
        payouts[r.userId] = {
          userId: r.userId,
          username: r.username,
          uid: r.uid || '',
          total: 0
        };
      }
      payouts[r.userId].total += r.kwota || 0;
    });

    const result = Object.values(payouts).sort((a, b) => {
      if (a.uid && b.uid) return parseInt(a.uid) - parseInt(b.uid);
      if (a.uid) return -1;
      if (b.uid) return 1;
      return b.total - a.total;
    });

    res.json({ payouts: result });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/payouts/export', requireAuth, requireRole('director'), (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);
    const payouts = {};

    reports.filter(r => r.status === 'accepted').forEach(r => {
      if (!payouts[r.userId]) {
        payouts[r.userId] = { uid: r.uid || '', total: 0 };
      }
      payouts[r.userId].total += r.kwota || 0;
    });

    const lines = Object.values(payouts)
      .sort((a, b) => {
        if (a.uid && b.uid) return parseInt(a.uid) - parseInt(b.uid);
        if (a.uid) return -1;
        if (b.uid) return 1;
        return b.total - a.total;
      })
      .map(p => `${p.uid};${p.total};Premia USSS`);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=payouts.txt');
    res.send(lines.join('\n'));
  } catch (error) {
    console.error('Error exporting payouts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== USERS MANAGEMENT ====================
app.get('/api/users', requireAuth, requireRole('director'), (req, res) => {
  try {
    const users = readJSON(USERS_FILE).map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      displayName: u.displayName,
      createdAt: u.createdAt
    }));
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', requireAuth, requireRole('director'), (req, res) => {
  try {
    const { username, password, role, displayName } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const users = readJSON(USERS_FILE);

    if (users.some(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = {
      id: Date.now().toString(),
      username,
      password: bcrypt.hashSync(password, 10),
      role,
      displayName: displayName || username,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    logAudit('USER_CREATE', req.session.user.id, { username, role });

    res.json({
      success: true,
      user: { id: newUser.id, username, role, displayName: newUser.displayName }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', requireAuth, requireRole('director'), (req, res) => {
  try {
    const users = readJSON(USERS_FILE);
    const index = users.findIndex(u => u.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (users[index].id === req.session.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const deletedUser = users.splice(index, 1)[0];
    writeJSON(USERS_FILE, users);

    logAudit('USER_DELETE', req.session.user.id, { username: deletedUser.username });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AUDIT LOG ====================
app.get('/api/audit', requireAuth, requireRole('director'), (req, res) => {
  try {
    const logs = readJSON(AUDIT_LOG_FILE);
    const { limit = 100 } = req.query;
    const recent = logs.slice(-parseInt(limit)).reverse();
    res.json({ logs: recent });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ADMIN ACTIONS ====================
app.post('/api/admin/clear-reports', requireAuth, requireRole('director'), (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);
    const count = reports.length;

    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(__dirname, 'data', `raporty.backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(reports, null, 2));

    // Clear reports
    writeJSON(RAPORTY_FILE, []);

    logAudit('CLEAR_REPORTS', req.session.user.id, { count, backupFile });

    res.json({ success: true, count, backupFile });
  } catch (error) {
    console.error('Error clearing reports:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/reset-stats', requireAuth, requireRole('director'), (req, res) => {
  try {
    const reports = readJSON(RAPORTY_FILE);

    // Reset all statuses to pending
    reports.forEach(r => {
      r.status = 'pending';
      delete r.updatedBy;
      delete r.updatedAt;
    });

    writeJSON(RAPORTY_FILE, reports);

    logAudit('RESET_STATS', req.session.user.id, { count: reports.length });

    res.json({ success: true, count: reports.length });
  } catch (error) {
    console.error('Error resetting stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SETTINGS ====================
app.get('/api/settings', requireAuth, (req, res) => {
  try {
    const settings = readJSON(SETTINGS_FILE);
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/settings', requireAuth, requireRole('director'), (req, res) => {
  try {
    const settings = readJSON(SETTINGS_FILE);
    const updates = req.body;

    Object.assign(settings, updates);
    writeJSON(SETTINGS_FILE, settings);

    logAudit('SETTINGS_UPDATE', req.session.user.id, updates);

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SERVE FRONTEND ====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`🛡️  USSS Management Portal running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
});
