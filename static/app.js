// ==================== USSS Management Portal - Frontend Application ====================

// ==================== State ====================
let currentUser = null;
let currentPage = 'dashboard';
let selectedReports = [];
let reportsData = { reports: [], total: 0, page: 1, totalPages: 1 };
let statsData = null;

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Check authentication
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      showApp();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLogin();
  }

  // Hide loader
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 2000);

  // Initialize navigation
  initNavigation();

  // Initialize global search
  initGlobalSearch();
}

function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  initLoginParticles();
}

function showApp() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Update user info
  document.getElementById('userName').textContent = currentUser.displayName || currentUser.username;
  document.getElementById('userRole').textContent = formatRole(currentUser.role);

  // Load initial page
  navigateTo('dashboard');
  updatePendingBadge();
}

function formatRole(role) {
  const roles = {
    director: 'Director',
    supervisor: 'Supervisor',
    agent: 'Agent'
  };
  return roles[role] || role;
}

// ==================== Login ====================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      showApp();
      showToast('Welcome back, ' + currentUser.displayName, 'success');
    } else {
      errorEl.textContent = data.error || 'Login failed';
      errorEl.classList.remove('hidden');
    }
  } catch (error) {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.remove('hidden');
  }
});

function togglePassword() {
  const input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    showLogin();
    showToast('Logged out successfully', 'info');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ==================== Navigation ====================
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update page title (Polish)
  const titles = {
    dashboard: 'Panel Główny',
    reports: 'Zarządzanie Raportami',
    statistics: 'Statystyki i Analityka',
    payouts: 'Wypłaty',
    notes: 'Notatki',
    users: 'Zarządzanie Użytkownikami',
    audit: 'Dziennik Audytu',
    settings: 'Ustawienia'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  // Load page content
  loadPageContent(page);

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

async function loadPageContent(page) {
  const wrapper = document.getElementById('contentWrapper');

  switch (page) {
    case 'dashboard':
      await renderDashboard(wrapper);
      break;
    case 'reports':
      await renderReports(wrapper);
      break;
    case 'statistics':
      await renderStatistics(wrapper);
      break;
    case 'payouts':
      await renderPayouts(wrapper);
      break;
    case 'notes':
      await renderNotes(wrapper);
      break;
    case 'users':
      await renderUsers(wrapper);
      break;
    case 'audit':
      await renderAudit(wrapper);
      break;
    case 'settings':
      await renderSettings(wrapper);
      break;
    default:
      wrapper.innerHTML = '<div class="empty-state"><p>Strona nie znaleziona</p></div>';
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// ==================== Dashboard ====================
async function renderDashboard(wrapper) {
  wrapper.innerHTML = `
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card skeleton"></div>
      <div class="stat-card skeleton"></div>
      <div class="stat-card skeleton"></div>
      <div class="stat-card skeleton"></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">Weekly Activity</h3>
        </div>
        <div class="chart-container" id="weeklyChart"></div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">Top Agents</h3>
        </div>
        <div class="top-users-list" id="topUsersList"></div>
      </div>
    </div>
  `;

  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    statsData = data;

    renderStatsCards(data.stats, data.totalPayout);
    renderWeeklyChart(data.dailyStats);
    renderTopUsers(data.topUsers);
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderStatsCards(stats, totalPayout) {
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-card total">
      <div class="stat-header">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
      </div>
      <div class="stat-value">${stats.total}</div>
      <div class="stat-label">Total Reports</div>
    </div>
    <div class="stat-card pending">
      <div class="stat-header">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
      </div>
      <div class="stat-value">${stats.pending}</div>
      <div class="stat-label">Pending Review</div>
    </div>
    <div class="stat-card accepted">
      <div class="stat-header">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
      </div>
      <div class="stat-value">${stats.accepted}</div>
      <div class="stat-label">Accepted</div>
    </div>
    <div class="stat-card rejected">
      <div class="stat-header">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
      </div>
      <div class="stat-value">${stats.rejected}</div>
      <div class="stat-label">Rejected</div>
    </div>
  `;
}

function renderWeeklyChart(dailyStats) {
  const container = document.getElementById('weeklyChart');
  const days = Object.entries(dailyStats);
  const maxValue = Math.max(...days.map(([, d]) => d.total), 1);

  container.innerHTML = days.map(([date, data]) => {
    const height = (data.total / maxValue) * 100;
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
    return `
      <div class="chart-bar" style="height: ${Math.max(height, 5)}%">
        <span class="chart-bar-value">${data.total}</span>
        <span class="chart-bar-label">${dayName}</span>
      </div>
    `;
  }).join('');
}

function renderTopUsers(topUsers) {
  const list = document.getElementById('topUsersList');

  if (!topUsers || topUsers.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No data available</p></div>';
    return;
  }

  list.innerHTML = topUsers.slice(0, 5).map((user, index) => `
    <div class="top-user-item">
      <div class="top-user-rank">${index + 1}</div>
      <div class="top-user-info">
        <div class="top-user-name">${escapeHtml(user.username || 'Unknown')}</div>
        <div class="top-user-uid">${user.uid ? `UID: ${user.uid}` : 'No UID'}</div>
      </div>
      <div class="top-user-amount">$${formatNumber(user.total)}</div>
    </div>
  `).join('');
}

// ==================== Reports ====================
let selectedUserId = null;
let allReportsData = [];

async function renderReports(wrapper) {
  wrapper.innerHTML = `
    <div class="reports-layout">
      <!-- Panel użytkowników (lewa strona) -->
      <div class="users-panel" id="usersPanel">
        <div class="users-panel-header">
          <h3>Funkcjonariusze</h3>
          <select class="filter-select-sm" id="statusFilter" onchange="loadReports()">
            <option value="pending">Oczekujące</option>
            <option value="all">Wszystkie</option>
            <option value="accepted">Zaakceptowane</option>
            <option value="rejected">Odrzucone</option>
          </select>
        </div>
        <input type="text" class="users-search" id="userSearchFilter" placeholder="Szukaj użytkownika..." oninput="filterUsersList()">
        <div class="users-list" id="usersList">
          <div class="loading">Ładowanie...</div>
        </div>
      </div>

      <!-- Raporty użytkownika (prawa strona) -->
      <div class="user-reports" id="userReports">
        <div class="user-reports-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <p>Wybierz funkcjonariusza z listy</p>
          <span>aby zobaczyć jego raporty</span>
        </div>
      </div>
    </div>

    <style>
      .reports-layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 20px;
        height: calc(100vh - 160px);
      }
      .users-panel {
        background: var(--bg-card);
        border-radius: 12px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .users-panel-header {
        padding: 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .users-panel-header h3 {
        margin: 0;
        font-size: 16px;
        color: var(--text-primary);
      }
      .filter-select-sm {
        padding: 6px 10px;
        font-size: 12px;
        background: var(--bg-input);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text-primary);
      }
      .users-search {
        margin: 12px;
        padding: 10px 14px;
        background: var(--bg-input);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--text-primary);
        font-size: 13px;
      }
      .users-search:focus {
        outline: none;
        border-color: var(--primary);
      }
      .users-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 12px 12px;
      }
      .user-item {
        padding: 12px 14px;
        border-radius: 8px;
        cursor: pointer;
        margin-bottom: 4px;
        transition: all 0.2s;
        border: 1px solid transparent;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .user-item:hover {
        background: var(--bg-hover);
      }
      .user-item.active {
        background: var(--primary);
        color: var(--bg-dark);
      }
      .user-item-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .user-item-name {
        font-weight: 600;
        font-size: 14px;
      }
      .user-item-uid {
        font-size: 11px;
        opacity: 0.7;
        font-family: 'JetBrains Mono', monospace;
      }
      .user-item-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .user-item-count {
        font-size: 12px;
        font-weight: 600;
      }
      .user-item-pending {
        font-size: 10px;
        padding: 2px 6px;
        background: var(--warning);
        color: var(--bg-dark);
        border-radius: 4px;
      }
      .user-item.active .user-item-pending {
        background: rgba(0,0,0,0.3);
        color: inherit;
      }
      .user-reports {
        background: var(--bg-card);
        border-radius: 12px;
        border: 1px solid var(--border);
        overflow-y: auto;
        padding: 20px;
      }
      .user-reports-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
        text-align: center;
      }
      .user-reports-placeholder svg {
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      .user-reports-placeholder p {
        font-size: 16px;
        margin-bottom: 4px;
      }
      .user-reports-placeholder span {
        font-size: 13px;
        opacity: 0.7;
      }
      .user-reports-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border);
      }
      .user-reports-info h2 {
        margin: 0 0 4px 0;
        font-size: 20px;
        color: var(--text-primary);
      }
      .user-reports-info span {
        font-size: 13px;
        color: var(--text-muted);
        font-family: 'JetBrains Mono', monospace;
      }
      .user-reports-actions {
        display: flex;
        gap: 8px;
      }
      .reports-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }
      .report-card {
        background: var(--bg-dark);
        border-radius: 12px;
        border: 1px solid var(--border);
        overflow: hidden;
        transition: all 0.2s;
      }
      .report-card:hover {
        border-color: var(--primary);
      }
      .report-card.pending { border-left: 4px solid var(--warning); }
      .report-card.accepted { border-left: 4px solid var(--success); }
      .report-card.rejected { border-left: 4px solid var(--error); }
      .report-card-image {
        width: 100%;
        height: 180px;
        object-fit: cover;
        cursor: pointer;
        background: var(--bg-input);
      }
      .report-card-no-image {
        width: 100%;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-input);
        color: var(--text-muted);
        font-size: 12px;
      }
      .report-card-body { padding: 14px; }
      .report-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .report-card-type {
        font-weight: 600;
        font-size: 13px;
        color: var(--text-primary);
      }
      .report-card-amount {
        color: var(--success);
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
        font-size: 14px;
      }
      .report-card-date {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 12px;
      }
      .report-card-actions {
        display: flex;
        gap: 8px;
      }
      .report-card-actions .btn {
        flex: 1;
        padding: 8px;
        font-size: 12px;
      }
      .report-card-status {
        text-align: center;
        padding: 8px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 6px;
      }
      .report-card-status.accepted {
        background: rgba(16, 185, 129, 0.1);
        color: var(--success);
      }
      .report-card-status.rejected {
        background: rgba(239, 68, 68, 0.1);
        color: var(--error);
      }
      .image-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
      }
      .image-modal img {
        max-width: 95%;
        max-height: 95%;
        object-fit: contain;
      }
      @media (max-width: 900px) {
        .reports-layout {
          grid-template-columns: 1fr;
          grid-template-rows: 250px 1fr;
        }
      }
    </style>
  `;

  await loadReports();
}

async function loadReports() {
  const status = document.getElementById('statusFilter')?.value || 'pending';

  try {
    const params = new URLSearchParams({ page: 1, limit: 1000, status });
    const response = await fetch(`/api/reports?${params}`);
    const data = await response.json();

    allReportsData = data.reports || [];
    renderUsersList();

    // Keep selected user if still has reports
    if (selectedUserId) {
      const userReports = allReportsData.filter(r => r.userId === selectedUserId);
      if (userReports.length > 0) {
        renderUserReports(selectedUserId);
      } else {
        selectedUserId = null;
        document.getElementById('userReports').innerHTML = `
          <div class="user-reports-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <p>Wybierz funkcjonariusza z listy</p>
            <span>aby zobaczyć jego raporty</span>
          </div>
        `;
      }
    }

    updatePendingBadge();
  } catch (error) {
    console.error('Error loading reports:', error);
    showToast('Nie udało się załadować raportów', 'error');
  }
}

function groupByUser(reports) {
  const grouped = {};
  reports.forEach(report => {
    const key = report.userId;
    if (!grouped[key]) {
      grouped[key] = {
        userId: report.userId,
        username: report.username,
        uid: report.uid,
        reports: [],
        pendingCount: 0
      };
    }
    grouped[key].reports.push(report);
    if (report.status === 'pending') {
      grouped[key].pendingCount++;
    }
  });
  return grouped;
}

function renderUsersList() {
  const container = document.getElementById('usersList');
  const grouped = groupByUser(allReportsData);

  // Sort by pending count (most pending first), then by total reports
  const sortedUsers = Object.values(grouped)
    .sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return b.reports.length - a.reports.length;
    });

  if (sortedUsers.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); padding: 20px; text-align: center;">Brak raportów</p>';
    return;
  }

  container.innerHTML = sortedUsers.map(user => `
    <div class="user-item ${selectedUserId === user.userId ? 'active' : ''}" onclick="selectUser('${user.userId}')">
      <div class="user-item-info">
        <div class="user-item-name">${escapeHtml(user.username || 'Unknown')}</div>
        ${user.uid ? `<div class="user-item-uid">UID: ${user.uid}</div>` : ''}
      </div>
      <div class="user-item-stats">
        <div class="user-item-count">${user.reports.length} rap.</div>
        ${user.pendingCount > 0 ? `<div class="user-item-pending">${user.pendingCount} oczek.</div>` : ''}
      </div>
    </div>
  `).join('');
}

function filterUsersList() {
  const search = document.getElementById('userSearchFilter')?.value?.toLowerCase() || '';
  const items = document.querySelectorAll('.user-item');

  items.forEach(item => {
    const name = item.querySelector('.user-item-name')?.textContent?.toLowerCase() || '';
    const uid = item.querySelector('.user-item-uid')?.textContent?.toLowerCase() || '';
    const matches = name.includes(search) || uid.includes(search);
    item.style.display = matches ? '' : 'none';
  });
}

function selectUser(userId) {
  selectedUserId = userId;

  // Update active state
  document.querySelectorAll('.user-item').forEach(item => {
    item.classList.toggle('active', item.onclick.toString().includes(userId));
  });

  renderUserReports(userId);
  renderUsersList(); // Refresh to update active state
}

function renderUserReports(userId) {
  const container = document.getElementById('userReports');
  const userReports = allReportsData.filter(r => r.userId === userId);

  if (userReports.length === 0) {
    container.innerHTML = `
      <div class="user-reports-placeholder">
        <p>Brak raportów dla tego użytkownika</p>
      </div>
    `;
    return;
  }

  const user = userReports[0];
  const pendingCount = userReports.filter(r => r.status === 'pending').length;

  // Sort by date (newest first)
  userReports.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = `
    <div class="user-reports-header">
      <div class="user-reports-info">
        <h2>${escapeHtml(user.username || 'Unknown')}</h2>
        <span>${user.uid ? `UID: ${user.uid} • ` : ''}${userReports.length} raportów${pendingCount > 0 ? ` • ${pendingCount} oczekujących` : ''}</span>
      </div>
      ${pendingCount > 0 ? `
        <div class="user-reports-actions">
          <button class="btn btn-success btn-sm" onclick="acceptAllUserReports('${userId}')">Akceptuj wszystkie (${pendingCount})</button>
        </div>
      ` : ''}
    </div>
    <div class="reports-grid">
      ${userReports.map(report => `
        <div class="report-card ${report.status}">
          ${report.attachment ? `
            <img src="${report.attachment}" class="report-card-image" onclick="openImageModal('${report.attachment}')" alt="Załącznik" loading="lazy" onerror="this.parentElement.querySelector('.report-card-no-image')?.remove(); this.style.display='none';">
          ` : `
            <div class="report-card-no-image">Brak zdjęcia</div>
          `}
          <div class="report-card-body">
            <div class="report-card-top">
              <span class="report-card-type">${escapeHtml(report.typ || '-')}</span>
              <span class="report-card-amount">$${formatNumber(report.kwota || 0)}</span>
            </div>
            <div class="report-card-date">${formatDate(report.date, true)}</div>
            ${report.status === 'pending' ? `
              <div class="report-card-actions">
                <button class="btn btn-success" onclick="updateReportStatus('${report.id}', 'accepted')">Akceptuj</button>
                <button class="btn btn-danger" onclick="updateReportStatus('${report.id}', 'rejected')">Odrzuć</button>
              </div>
            ` : `
              <div class="report-card-status ${report.status}">
                ${report.status === 'accepted' ? '✓ Zaakceptowano' : '✗ Odrzucono'}
              </div>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function acceptAllUserReports(userId) {
  const pendingReports = allReportsData.filter(r => r.userId === userId && r.status === 'pending');
  if (pendingReports.length === 0) return;

  if (!confirm(`Czy na pewno chcesz zaakceptować wszystkie ${pendingReports.length} oczekujących raportów tego użytkownika?`)) return;

  const ids = pendingReports.map(r => r.id);

  try {
    const response = await fetch('/api/reports/bulk/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(`Zaakceptowano ${data.updated} raportów`, 'success');
      await loadReports();
    } else {
      showToast(data.error || 'Błąd', 'error');
    }
  } catch (error) {
    showToast('Błąd akceptacji', 'error');
  }
}

function openImageModal(imageUrl) {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.innerHTML = `<img src="${imageUrl}" alt="Powiększony załącznik">`;
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}

function renderReportsTable(reports) {
  // Keep for compatibility
}

function renderPagination(data) {
  const paginationInfo = document.getElementById('paginationInfo');
  const pagination = document.getElementById('pagination');

  const start = ((data.page - 1) * 20) + 1;
  const end = Math.min(data.page * 20, data.total);

  paginationInfo.textContent = `Showing ${data.total > 0 ? start : 0}-${end} of ${data.total} reports`;

  if (data.totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let pages = [];
  for (let i = 1; i <= data.totalPages; i++) {
    if (i === 1 || i === data.totalPages || (i >= data.page - 2 && i <= data.page + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  pagination.innerHTML = `
    <button class="pagination-btn" onclick="loadReports(${data.page - 1})" ${data.page === 1 ? 'disabled' : ''}>Prev</button>
    ${pages.map(p => p === '...'
      ? '<span class="pagination-btn" style="cursor: default;">...</span>'
      : `<button class="pagination-btn ${p === data.page ? 'active' : ''}" onclick="loadReports(${p})">${p}</button>`
    ).join('')}
    <button class="pagination-btn" onclick="loadReports(${data.page + 1})" ${data.page === data.totalPages ? 'disabled' : ''}>Next</button>
  `;
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.report-checkbox:not(:disabled)');
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
  updateSelection();
}

function updateSelection() {
  const checkboxes = document.querySelectorAll('.report-checkbox:checked');
  selectedReports = Array.from(checkboxes).map(cb => cb.value);

  const bulkActions = document.getElementById('bulkActions');
  if (bulkActions) {
    bulkActions.style.display = selectedReports.length > 0 ? 'flex' : 'none';
  }
}

async function updateReportStatus(id, status) {
  try {
    const response = await fetch(`/api/reports/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      showToast(`Report ${status}`, 'success');
      loadReports(reportsData.page);
    } else {
      const data = await response.json();
      showToast(data.error || 'Failed to update report', 'error');
    }
  } catch (error) {
    showToast('Failed to update report', 'error');
  }
}

async function bulkAccept() {
  if (selectedReports.length === 0) return;

  try {
    const response = await fetch('/api/reports/bulk/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedReports })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(`${data.updated} reports accepted`, 'success');
      selectedReports = [];
      loadReports(reportsData.page);
    } else {
      showToast(data.error || 'Failed to accept reports', 'error');
    }
  } catch (error) {
    showToast('Failed to accept reports', 'error');
  }
}

async function bulkReject() {
  if (selectedReports.length === 0) return;

  try {
    const response = await fetch('/api/reports/bulk/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedReports })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(`${data.updated} reports rejected`, 'success');
      selectedReports = [];
      loadReports(reportsData.page);
    } else {
      showToast(data.error || 'Failed to reject reports', 'error');
    }
  } catch (error) {
    showToast('Failed to reject reports', 'error');
  }
}

function viewReport(id) {
  const report = reportsData.reports.find(r => r.id === id);
  if (!report) return;

  showModal(`
    <div class="modal-header">
      <h2 class="modal-title">Report Details</h2>
      <button class="modal-close" onclick="closeModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">User</label>
        <p>${escapeHtml(report.username || 'Unknown')} ${report.uid ? `(UID: ${report.uid})` : ''}</p>
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <p>${escapeHtml(report.typ)}</p>
      </div>
      <div class="form-group">
        <label class="form-label">Amount</label>
        <p class="amount-cell">$${formatNumber(report.kwota || 0)}</p>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <p><span class="status-badge ${report.status}">${report.status}</span></p>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <p>${formatDate(report.date, true)}</p>
      </div>
      ${report.attachment ? `
        <div class="form-group">
          <label class="form-label">Attachment</label>
          <p><a href="${report.attachment}" target="_blank" rel="noopener">View Image</a></p>
        </div>
      ` : ''}
      ${report.updatedBy ? `
        <div class="form-group">
          <label class="form-label">Updated By</label>
          <p>${escapeHtml(report.updatedBy)} at ${formatDate(report.updatedAt, true)}</p>
        </div>
      ` : ''}
    </div>
    ${report.status === 'pending' ? `
      <div class="modal-footer">
        <button class="btn btn-success" onclick="updateReportStatus('${report.id}', 'accepted'); closeModal();">Accept</button>
        <button class="btn btn-danger" onclick="updateReportStatus('${report.id}', 'rejected'); closeModal();">Reject</button>
      </div>
    ` : ''}
  `);
}

let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadReports(), 300);
}

function filterReports() {
  loadReports();
}

// ==================== Statistics ====================
async function renderStatistics(wrapper) {
  wrapper.innerHTML = `
    <div class="stats-grid" id="statsGridFull"></div>
    <div class="chart-card mt-6">
      <div class="chart-header">
        <h3 class="chart-title">Reports by Type</h3>
      </div>
      <div id="typeStatsContainer" style="padding: 20px;"></div>
    </div>
  `;

  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    document.getElementById('statsGridFull').innerHTML = `
      <div class="stat-card total">
        <div class="stat-header">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>
        <div class="stat-value">$${formatNumber(data.totalPayout)}</div>
        <div class="stat-label">Total Payouts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.stats.total}</div>
        <div class="stat-label">Total Reports</div>
      </div>
      <div class="stat-card accepted">
        <div class="stat-value">${data.stats.accepted}</div>
        <div class="stat-label">Accepted</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">${data.stats.pending}</div>
        <div class="stat-label">Pending</div>
      </div>
    `;

    // Render type stats
    const typeStats = Object.entries(data.byType)
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count > 0);

    if (typeStats.length > 0) {
      const maxCount = Math.max(...typeStats.map(([, c]) => c));
      document.getElementById('typeStatsContainer').innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${typeStats.map(([type, count]) => `
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 200px; font-size: 13px; color: var(--text-secondary);">${escapeHtml(type)}</div>
              <div style="flex: 1; height: 24px; background: var(--bg-input); border-radius: 4px; overflow: hidden;">
                <div style="width: ${(count / maxCount) * 100}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-dark)); display: flex; align-items: center; justify-content: flex-end; padding-right: 8px;">
                  <span style="font-size: 12px; font-weight: 600; color: var(--bg-dark);">${count}</span>
                </div>
              </div>
              <div style="width: 80px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--success);">
                $${formatNumber(count * (data.premieTypes[type] || 0))}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      document.getElementById('typeStatsContainer').innerHTML = '<p class="text-center" style="color: var(--text-muted);">No accepted reports yet</p>';
    }
  } catch (error) {
    console.error('Error loading statistics:', error);
    showToast('Failed to load statistics', 'error');
  }
}

// ==================== Payouts ====================
async function renderPayouts(wrapper) {
  wrapper.innerHTML = `
    <div class="payouts-summary" id="payoutsSummary"></div>
    <div class="table-container">
      <div class="table-header">
        <h3 class="table-title">Payout Summary</h3>
        <div class="table-filters">
          <button class="btn btn-primary" onclick="exportPayouts()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>UID</th>
            <th>Username</th>
            <th>Total Payout</th>
          </tr>
        </thead>
        <tbody id="payoutsTableBody">
          <tr><td colspan="3" class="text-center">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const response = await fetch('/api/payouts');
    const data = await response.json();

    const totalAmount = data.payouts.reduce((sum, p) => sum + p.total, 0);
    const avgPayout = data.payouts.length > 0 ? totalAmount / data.payouts.length : 0;

    document.getElementById('payoutsSummary').innerHTML = `
      <div class="payout-card">
        <div class="payout-card-value">$${formatNumber(totalAmount)}</div>
        <div class="payout-card-label">Total Payouts</div>
      </div>
      <div class="payout-card">
        <div class="payout-card-value">${data.payouts.length}</div>
        <div class="payout-card-label">Agents</div>
      </div>
      <div class="payout-card">
        <div class="payout-card-value">$${formatNumber(Math.round(avgPayout))}</div>
        <div class="payout-card-label">Average Payout</div>
      </div>
    `;

    const tbody = document.getElementById('payoutsTableBody');
    if (data.payouts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center">No payouts yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.payouts.map(p => `
      <tr>
        <td class="date-cell">${p.uid || '-'}</td>
        <td>${escapeHtml(p.username || 'Unknown')}</td>
        <td class="amount-cell">$${formatNumber(p.total)}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading payouts:', error);
    showToast('Failed to load payouts', 'error');
  }
}

async function exportPayouts() {
  try {
    window.open('/api/payouts/export', '_blank');
    showToast('Eksport rozpoczęty', 'success');
  } catch (error) {
    showToast('Eksport nie powiódł się', 'error');
  }
}

// ==================== Notes ====================
let notesData = [];
let activeNoteId = null;
let autoSaveTimeout = null;

async function renderNotes(wrapper) {
  wrapper.innerHTML = `
    <div class="notes-container">
      <div class="notes-sidebar">
        <div class="notes-header">
          <h3>Moje Notatki</h3>
          <div class="notes-actions">
            <button class="btn btn-primary btn-sm" onclick="createNote()" title="Nowa notatka">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button class="btn btn-outline btn-sm" onclick="importNote()" title="Importuj">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="notes-count" id="notesCount">0/10 notatek</div>
        <div class="notes-list" id="notesList">
          <div class="loading">Ładowanie...</div>
        </div>
      </div>
      <div class="notes-editor">
        <div class="notes-editor-header" id="notesEditorHeader">
          <input type="text" class="note-title-input" id="noteTitleInput" placeholder="Tytuł notatki..." disabled>
          <button class="btn btn-danger btn-sm" onclick="deleteActiveNote()" id="deleteNoteBtn" disabled title="Usuń notatkę">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
        <textarea class="note-content-input" id="noteContentInput" placeholder="Wybierz notatkę lub utwórz nową..." disabled></textarea>
        <div class="notes-editor-footer" id="notesEditorFooter">
          <span id="noteStatus">Wybierz notatkę</span>
          <span id="noteLastSaved"></span>
        </div>
      </div>
    </div>
    <input type="file" id="importFileInput" accept=".txt,.md,.json" style="display: none;" onchange="handleFileImport(event)">
    <style>
      .notes-container {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: 20px;
        height: calc(100vh - 180px);
        min-height: 500px;
      }
      .notes-sidebar {
        background: var(--bg-card);
        border-radius: 12px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .notes-header {
        padding: 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .notes-header h3 {
        margin: 0;
        font-size: 16px;
        color: var(--text-primary);
      }
      .notes-actions {
        display: flex;
        gap: 8px;
      }
      .notes-count {
        padding: 8px 16px;
        font-size: 12px;
        color: var(--text-muted);
        border-bottom: 1px solid var(--border);
      }
      .notes-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      .note-item {
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        margin-bottom: 4px;
        transition: all 0.2s;
        border: 1px solid transparent;
      }
      .note-item:hover {
        background: var(--bg-hover);
      }
      .note-item.active {
        background: var(--primary);
        color: var(--bg-dark);
        border-color: var(--primary);
      }
      .note-item-title {
        font-weight: 500;
        font-size: 14px;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .note-item-date {
        font-size: 11px;
        opacity: 0.7;
      }
      .notes-editor {
        background: var(--bg-card);
        border-radius: 12px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .notes-editor-header {
        padding: 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .note-title-input {
        flex: 1;
        background: var(--bg-input);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px 14px;
        color: var(--text-primary);
        font-size: 16px;
        font-weight: 600;
      }
      .note-title-input:focus {
        outline: none;
        border-color: var(--primary);
      }
      .note-content-input {
        flex: 1;
        background: var(--bg-dark);
        border: none;
        padding: 20px;
        color: var(--text-primary);
        font-family: 'JetBrains Mono', monospace;
        font-size: 14px;
        line-height: 1.6;
        resize: none;
      }
      .note-content-input:focus {
        outline: none;
      }
      .note-content-input::placeholder {
        color: var(--text-muted);
      }
      .notes-editor-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--text-muted);
      }
      .notes-empty {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
      }
      .notes-empty svg {
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }
      @media (max-width: 768px) {
        .notes-container {
          grid-template-columns: 1fr;
          grid-template-rows: 200px 1fr;
        }
      }
    </style>
  `;

  await loadNotes();

  // Setup auto-save
  document.getElementById('noteTitleInput').addEventListener('input', () => autoSaveNote());
  document.getElementById('noteContentInput').addEventListener('input', () => autoSaveNote());
}

async function loadNotes() {
  try {
    const response = await fetch('/api/notes');
    const data = await response.json();
    notesData = data.notes || [];
    renderNotesList();
  } catch (error) {
    console.error('Error loading notes:', error);
    showToast('Nie udało się załadować notatek', 'error');
  }
}

function renderNotesList() {
  const list = document.getElementById('notesList');
  const count = document.getElementById('notesCount');

  count.textContent = `${notesData.length}/10 notatek`;

  if (notesData.length === 0) {
    list.innerHTML = `
      <div class="notes-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>Brak notatek</p>
        <p style="font-size: 11px;">Kliknij + aby utworzyć</p>
      </div>
    `;
    return;
  }

  list.innerHTML = notesData
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(note => `
      <div class="note-item ${note.id === activeNoteId ? 'active' : ''}" onclick="selectNote('${note.id}')">
        <div class="note-item-title">${escapeHtml(note.title || 'Bez tytułu')}</div>
        <div class="note-item-date">${formatDate(note.updatedAt, true)}</div>
      </div>
    `).join('');
}

function selectNote(noteId) {
  activeNoteId = noteId;
  const note = notesData.find(n => n.id === noteId);

  if (!note) return;

  const titleInput = document.getElementById('noteTitleInput');
  const contentInput = document.getElementById('noteContentInput');
  const deleteBtn = document.getElementById('deleteNoteBtn');
  const status = document.getElementById('noteStatus');
  const lastSaved = document.getElementById('noteLastSaved');

  titleInput.value = note.title || '';
  titleInput.disabled = false;
  contentInput.value = note.content || '';
  contentInput.disabled = false;
  deleteBtn.disabled = false;
  status.textContent = 'Gotowe';
  lastSaved.textContent = `Ostatni zapis: ${formatDate(note.updatedAt, true)}`;

  renderNotesList();
}

async function createNote() {
  if (notesData.length >= 10) {
    showToast('Maksymalnie 10 notatek. Usuń jedną, aby dodać nową.', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nowa notatka', content: '' })
    });

    const data = await response.json();

    if (response.ok) {
      notesData.push(data.note);
      selectNote(data.note.id);
      showToast('Notatka utworzona', 'success');
    } else {
      showToast(data.error || 'Nie udało się utworzyć notatki', 'error');
    }
  } catch (error) {
    showToast('Nie udało się utworzyć notatki', 'error');
  }
}

function autoSaveNote() {
  if (!activeNoteId) return;

  const status = document.getElementById('noteStatus');
  status.textContent = 'Zapisywanie...';

  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => saveActiveNote(), 1000);
}

async function saveActiveNote() {
  if (!activeNoteId) return;

  const title = document.getElementById('noteTitleInput').value;
  const content = document.getElementById('noteContentInput').value;
  const status = document.getElementById('noteStatus');
  const lastSaved = document.getElementById('noteLastSaved');

  try {
    const response = await fetch(`/api/notes/${activeNoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    const data = await response.json();

    if (response.ok) {
      const noteIndex = notesData.findIndex(n => n.id === activeNoteId);
      if (noteIndex !== -1) {
        notesData[noteIndex] = data.note;
      }
      status.textContent = 'Zapisano';
      lastSaved.textContent = `Ostatni zapis: ${formatDate(data.note.updatedAt, true)}`;
      renderNotesList();
    }
  } catch (error) {
    status.textContent = 'Błąd zapisu';
  }
}

async function deleteActiveNote() {
  if (!activeNoteId) return;

  const note = notesData.find(n => n.id === activeNoteId);
  if (!confirm(`Czy na pewno chcesz usunąć notatkę "${note?.title || 'Bez tytułu'}"?`)) return;

  try {
    const response = await fetch(`/api/notes/${activeNoteId}`, { method: 'DELETE' });

    if (response.ok) {
      notesData = notesData.filter(n => n.id !== activeNoteId);
      activeNoteId = null;

      document.getElementById('noteTitleInput').value = '';
      document.getElementById('noteTitleInput').disabled = true;
      document.getElementById('noteContentInput').value = '';
      document.getElementById('noteContentInput').disabled = true;
      document.getElementById('deleteNoteBtn').disabled = true;
      document.getElementById('noteStatus').textContent = 'Wybierz notatkę';
      document.getElementById('noteLastSaved').textContent = '';

      renderNotesList();
      showToast('Notatka usunięta', 'success');
    }
  } catch (error) {
    showToast('Nie udało się usunąć notatki', 'error');
  }
}

function importNote() {
  if (notesData.length >= 10) {
    showToast('Maksymalnie 10 notatek. Usuń jedną, aby zaimportować.', 'warning');
    return;
  }
  document.getElementById('importFileInput').click();
}

async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const content = await file.text();
    const title = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

    const response = await fetch('/api/notes/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    const data = await response.json();

    if (response.ok) {
      notesData.push(data.note);
      selectNote(data.note.id);
      showToast('Notatka zaimportowana', 'success');
    } else {
      showToast(data.error || 'Nie udało się zaimportować', 'error');
    }
  } catch (error) {
    showToast('Nie udało się zaimportować pliku', 'error');
  }

  event.target.value = '';
}

// ==================== Users ====================
async function renderUsers(wrapper) {
  if (currentUser.role !== 'director') {
    wrapper.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h3 class="empty-state-title">Access Denied</h3>
        <p class="empty-state-text">Only Directors can manage users</p>
      </div>
    `;
    return;
  }

  wrapper.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 style="color: var(--text-primary);">System Users</h2>
      <button class="btn btn-primary" onclick="showAddUserModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add User
      </button>
    </div>
    <div class="users-grid" id="usersGrid">Loading...</div>
  `;

  try {
    const response = await fetch('/api/users');
    const data = await response.json();

    const grid = document.getElementById('usersGrid');
    grid.innerHTML = data.users.map(user => `
      <div class="user-card">
        <div class="user-card-header">
          <div class="user-card-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="user-card-info">
            <h3>${escapeHtml(user.displayName || user.username)}</h3>
            <span class="role">${formatRole(user.role)}</span>
          </div>
        </div>
        <div class="user-card-actions">
          ${user.id !== currentUser.id ? `
            <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}', '${escapeHtml(user.username)}')">
              Delete
            </button>
          ` : '<span style="color: var(--text-muted); font-size: 12px;">Current User</span>'}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading users:', error);
    showToast('Failed to load users', 'error');
  }
}

function showAddUserModal() {
  showModal(`
    <div class="modal-header">
      <h2 class="modal-title">Add New User</h2>
      <button class="modal-close" onclick="closeModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <form id="addUserForm" onsubmit="addUser(event)">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" name="username" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" name="password" required>
        </div>
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input type="text" class="form-input" name="displayName">
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-select" name="role" required>
            <option value="agent">Agent</option>
            <option value="supervisor">Supervisor</option>
            <option value="director">Director</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="document.getElementById('addUserForm').dispatchEvent(new Event('submit'))">Add User</button>
    </div>
  `);
}

async function addUser(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password'),
        displayName: formData.get('displayName'),
        role: formData.get('role')
      })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('User created successfully', 'success');
      closeModal();
      renderUsers(document.getElementById('contentWrapper'));
    } else {
      showToast(data.error || 'Failed to create user', 'error');
    }
  } catch (error) {
    showToast('Failed to create user', 'error');
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

  try {
    const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (response.ok) {
      showToast('User deleted', 'success');
      renderUsers(document.getElementById('contentWrapper'));
    } else {
      showToast(data.error || 'Failed to delete user', 'error');
    }
  } catch (error) {
    showToast('Failed to delete user', 'error');
  }
}

// ==================== Audit Log ====================
async function renderAudit(wrapper) {
  if (currentUser.role !== 'director') {
    wrapper.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h3 class="empty-state-title">Access Denied</h3>
        <p class="empty-state-text">Only Directors can view audit logs</p>
      </div>
    `;
    return;
  }

  wrapper.innerHTML = `
    <div class="table-container">
      <div class="table-header">
        <h3 class="table-title">Audit Log</h3>
      </div>
      <div class="audit-list" id="auditList">Loading...</div>
    </div>
  `;

  try {
    const response = await fetch('/api/audit?limit=100');
    const data = await response.json();

    const list = document.getElementById('auditList');
    if (!data.logs || data.logs.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No audit logs yet</p></div>';
      return;
    }

    list.innerHTML = data.logs.map(log => `
      <div class="audit-item">
        <div class="audit-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${getAuditIcon(log.action)}
          </svg>
        </div>
        <div class="audit-content">
          <div class="audit-action">${formatAuditAction(log.action)}</div>
          <div class="audit-details">${formatAuditDetails(log)}</div>
        </div>
        <div class="audit-time">${formatDate(log.timestamp, true)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading audit:', error);
    showToast('Failed to load audit log', 'error');
  }
}

function getAuditIcon(action) {
  const icons = {
    LOGIN: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
    LOGOUT: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    REPORT_STATUS_CHANGE: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    USER_CREATE: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    USER_DELETE: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="11" x2="23" y2="11"/>',
    RESTORE_BACKUP: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    DELETE_BACKUP: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
  };
  return icons[action] || '<circle cx="12" cy="12" r="10"/>';
}

function formatAuditAction(action) {
  const actions = {
    LOGIN: 'User Login',
    LOGOUT: 'User Logout',
    REPORT_STATUS_CHANGE: 'Report Status Changed',
    REPORT_TYPE_CHANGE: 'Report Type Changed',
    BULK_ACCEPT: 'Bulk Accept',
    BULK_REJECT: 'Bulk Reject',
    USER_CREATE: 'User Created',
    USER_DELETE: 'User Deleted',
    CLEAR_REPORTS: 'Reports Cleared',
    RESET_STATS: 'Statistics Reset',
    SETTINGS_UPDATE: 'Settings Updated',
    RESTORE_BACKUP: 'Backup Restored',
    DELETE_BACKUP: 'Backup Deleted'
  };
  return actions[action] || action;
}

function formatAuditDetails(log) {
  const details = log.details || {};
  switch (log.action) {
    case 'LOGIN':
    case 'LOGOUT':
      return `User: ${details.username || 'Unknown'}`;
    case 'REPORT_STATUS_CHANGE':
      return `${details.username || 'User'}: ${details.oldStatus} → ${details.newStatus}`;
    case 'BULK_ACCEPT':
    case 'BULK_REJECT':
      return `${details.count || 0} reports`;
    case 'USER_CREATE':
      return `Created: ${details.username} (${details.role})`;
    case 'USER_DELETE':
      return `Deleted: ${details.username}`;
    case 'RESTORE_BACKUP':
      return `Restored ${details.restoredCount || 0} reports from ${details.filename || 'backup'}`;
    case 'DELETE_BACKUP':
      return `Deleted: ${details.filename || 'backup'}`;
    default:
      return JSON.stringify(details).slice(0, 50);
  }
}

// ==================== Settings ====================
async function renderSettings(wrapper) {
  if (currentUser.role !== 'director') {
    wrapper.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <h3 class="empty-state-title">Access Denied</h3>
        <p class="empty-state-text">Only Directors can access settings</p>
      </div>
    `;
    return;
  }

  wrapper.innerHTML = `
    <div class="settings-section">
      <h3 class="settings-title">Backups</h3>
      <div id="backupsList" style="margin-top: 16px;">Loading backups...</div>
    </div>

    <div class="settings-section">
      <h3 class="settings-title">Danger Zone</h3>
      <div class="settings-row">
        <div class="settings-info">
          <h4>Clear All Reports</h4>
          <p>Remove all reports from the system. A backup will be created.</p>
        </div>
        <button class="btn btn-danger" onclick="clearAllReports()">Clear Reports</button>
      </div>
      <div class="settings-row">
        <div class="settings-info">
          <h4>Reset All Statistics</h4>
          <p>Reset all report statuses to pending.</p>
        </div>
        <button class="btn btn-danger" onclick="resetStats()">Reset Stats</button>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="settings-title">System Information</h3>
      <div class="settings-row">
        <div class="settings-info">
          <h4>Version</h4>
          <p>USSS Management Portal v1.0.0</p>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-info">
          <h4>Current User</h4>
          <p>${currentUser.displayName || currentUser.username} (${formatRole(currentUser.role)})</p>
        </div>
      </div>
    </div>
  `;

  // Load backups
  await loadBackups();
}

async function loadBackups() {
  try {
    const response = await fetch('/api/admin/backups');
    const data = await response.json();

    const container = document.getElementById('backupsList');
    if (!data.backups || data.backups.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">No backups available</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table" style="margin-top: 8px;">
        <thead>
          <tr>
            <th>Backup File</th>
            <th>Date</th>
            <th>Reports</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.backups.map(backup => `
            <tr>
              <td style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${escapeHtml(backup.filename)}</td>
              <td>${formatDate(backup.date, true)}</td>
              <td>${backup.reportCount}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn btn-success btn-sm" onclick="restoreBackup('${escapeHtml(backup.filename)}')" title="Restore">
                    Restore
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="deleteBackup('${escapeHtml(backup.filename)}')" title="Delete">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading backups:', error);
    document.getElementById('backupsList').innerHTML = '<p style="color: var(--error);">Failed to load backups</p>';
  }
}

async function restoreBackup(filename) {
  if (!confirm(`Are you sure you want to restore from "${filename}"?\n\nA backup of current data will be created before restore.`)) return;

  try {
    const response = await fetch('/api/admin/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(`Restored ${data.restoredCount} reports from backup`, 'success');
      loadBackups();
      updatePendingBadge();
    } else {
      showToast(data.error || 'Failed to restore backup', 'error');
    }
  } catch (error) {
    showToast('Failed to restore backup', 'error');
  }
}

async function deleteBackup(filename) {
  if (!confirm(`Are you sure you want to delete backup "${filename}"?`)) return;

  try {
    const response = await fetch(`/api/admin/backups/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Backup deleted', 'success');
      loadBackups();
    } else {
      showToast(data.error || 'Failed to delete backup', 'error');
    }
  } catch (error) {
    showToast('Failed to delete backup', 'error');
  }
}

async function clearAllReports() {
  if (!confirm('Are you sure you want to clear ALL reports? A backup will be created.')) return;

  try {
    const response = await fetch('/api/admin/clear-reports', { method: 'POST' });
    const data = await response.json();

    if (response.ok) {
      showToast(`Cleared ${data.count} reports. Backup: ${data.backupFile}`, 'success');
      updatePendingBadge();
    } else {
      showToast(data.error || 'Failed to clear reports', 'error');
    }
  } catch (error) {
    showToast('Failed to clear reports', 'error');
  }
}

async function resetStats() {
  if (!confirm('Are you sure you want to reset all statistics?')) return;

  try {
    const response = await fetch('/api/admin/reset-stats', { method: 'POST' });
    const data = await response.json();

    if (response.ok) {
      showToast(`Reset ${data.count} reports to pending`, 'success');
      updatePendingBadge();
    } else {
      showToast(data.error || 'Failed to reset stats', 'error');
    }
  } catch (error) {
    showToast('Failed to reset stats', 'error');
  }
}

// ==================== Utilities ====================
async function updatePendingBadge() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    const badge = document.getElementById('pendingBadge');
    if (badge) {
      badge.textContent = data.stats.pending;
      badge.style.display = data.stats.pending > 0 ? 'inline' : 'none';
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

function refreshData() {
  loadPageContent(currentPage);
  showToast('Data refreshed', 'info');
}

function updateDateTime() {
  const el = document.getElementById('datetime');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function formatDate(dateStr, full = false) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (full) {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initGlobalSearch() {
  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        navigateTo('reports');
        setTimeout(() => {
          const filter = document.getElementById('searchFilter');
          if (filter) {
            filter.value = searchInput.value;
            loadReports();
          }
        }, 100);
      }
    });
  }
}

// ==================== Toast Notifications ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${icons[type] || icons.info}
    </svg>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ==================== Modal ====================
function showModal(content) {
  const container = document.getElementById('modalContainer');
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = content;
  container.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalContainer').classList.add('hidden');
}

// ==================== Login Particles ====================
function initLoginParticles() {
  const container = document.getElementById('loginParticles');
  if (!container) return;

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      background: rgba(201, 162, 39, ${Math.random() * 0.5 + 0.2});
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: float ${Math.random() * 10 + 10}s linear infinite;
    `;
    container.appendChild(particle);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes float {
      0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(-100vh) translateX(${Math.random() * 200 - 100}px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
