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

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    reports: 'Reports Management',
    statistics: 'Statistics & Analytics',
    payouts: 'Payouts',
    users: 'User Management',
    audit: 'Audit Log',
    settings: 'Settings'
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
    case 'users':
      await renderUsers(wrapper);
      break;
    case 'audit':
      await renderAudit(wrapper);
      break;
    case 'settings':
      renderSettings(wrapper);
      break;
    default:
      wrapper.innerHTML = '<div class="empty-state"><p>Page not found</p></div>';
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
async function renderReports(wrapper) {
  wrapper.innerHTML = `
    <div class="table-container">
      <div class="table-header">
        <h3 class="table-title">All Reports</h3>
        <div class="table-filters">
          <select class="filter-select" id="statusFilter" onchange="filterReports()">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="text" class="filter-input" id="searchFilter" placeholder="Search by name, UID, type..." onkeyup="debounceSearch()">
          <div class="bulk-actions" id="bulkActions" style="display: none;">
            <button class="btn btn-success" onclick="bulkAccept()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Accept Selected
            </button>
            <button class="btn btn-danger" onclick="bulkReject()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reject Selected
            </button>
          </div>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"></th>
            <th>User</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="reportsTableBody">
          <tr><td colspan="7" class="text-center">Loading...</td></tr>
        </tbody>
      </table>
      <div class="table-footer">
        <div class="pagination-info" id="paginationInfo">Showing 0 of 0 reports</div>
        <div class="pagination" id="pagination"></div>
      </div>
    </div>
  `;

  await loadReports();
}

async function loadReports(page = 1) {
  const status = document.getElementById('statusFilter')?.value || 'all';
  const search = document.getElementById('searchFilter')?.value || '';

  try {
    const params = new URLSearchParams({ page, limit: 20, status, search });
    const response = await fetch(`/api/reports?${params}`);
    const data = await response.json();

    reportsData = data;
    renderReportsTable(data.reports);
    renderPagination(data);
    updatePendingBadge();
  } catch (error) {
    console.error('Error loading reports:', error);
    showToast('Failed to load reports', 'error');
  }
}

function renderReportsTable(reports) {
  const tbody = document.getElementById('reportsTableBody');

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3 class="empty-state-title">No reports found</h3>
            <p class="empty-state-text">No reports available yet</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reports.map(report => `
    <tr data-id="${report.id}">
      <td>
        <input type="checkbox" class="report-checkbox" value="${report.id}"
          ${report.status !== 'pending' ? 'disabled' : ''}
          onchange="updateSelection()">
      </td>
      <td>
        <div class="user-cell">
          <span class="user-cell-name">${escapeHtml(report.username || 'Unknown')}</span>
          <span class="user-cell-uid">${report.uid ? `UID: ${report.uid}` : ''}</span>
        </div>
      </td>
      <td>${escapeHtml(report.typ || '-')}</td>
      <td class="amount-cell">$${formatNumber(report.kwota || 0)}</td>
      <td><span class="status-badge ${report.status}">${report.status}</span></td>
      <td class="date-cell">${formatDate(report.date)}</td>
      <td>
        <div class="actions-cell">
          ${report.status === 'pending' ? `
            <button class="action-btn accept" onclick="updateReportStatus('${report.id}', 'accepted')" title="Accept">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button class="action-btn reject" onclick="updateReportStatus('${report.id}', 'rejected')" title="Reject">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          ` : ''}
          <button class="action-btn" onclick="viewReport('${report.id}')" title="View Details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
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
    showToast('Export started', 'success');
  } catch (error) {
    showToast('Export failed', 'error');
  }
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
