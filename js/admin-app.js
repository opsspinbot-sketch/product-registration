import { 
  checkAdminAuth, loginAdmin, logoutAdmin, getAdminCredentials, saveAdminCredentials,
  loginWithGoogle, getAllowedAdminEmails, addAllowedAdminEmail, removeAllowedAdminEmail, syncAllowedAdminEmailsFromDB
} from './auth-service.js?v=16.0.0';
import { 
  getRegistrations, getRegistrationById, updateRegistrationStatus, getCustomers, getProducts, addProduct, updateProduct, deleteProduct,
  getSupportTickets, createSupportTicket, replySupportTicket, updateTicketStatus,
  getClaims, createClaim, updateClaimStatus, getRecentActivity, generateUniqueId, calculateWarrantyDates,
  subscribeToRegistrations, subscribeToCustomers, DEFAULT_CATALOG_PRODUCTS, upsertCustomer,
  getMarketplaces, addMarketplace, deleteMarketplace, subscribeToMarketplaces,
  getTermsAndConditions, saveTermsAndConditions
} from './db-service.js?v=16.0.0';
import { 
  showToast, showModal, renderEmptyState, renderPaginationContainer, exportToCSV, exportToPDF, renderStatusBadge, formatDate 
} from './ui-components.js?v=16.0.0';
import { renderBarChart, renderDonutChart } from './simple-charts.js?v=16.0.0';

window.getAdminCredentials = getAdminCredentials;
window.getAllowedAdminEmails = getAllowedAdminEmails;

window.handleSaveAdminCredentials = (e) => {
  if (e) e.preventDefault();
  const email = document.getElementById('setAdminEmail').value;
  const pass = document.getElementById('setAdminPass').value;
  if (!email || !pass) {
    showToast('Both Email and Password are required', 'warning');
    return;
  }
  saveAdminCredentials(email, pass);
  showToast('Authorized Admin Login Credentials Updated Successfully!', 'success');
};

window.handleGoogleLoginClick = async () => {
  const loginErr = document.getElementById('loginError');
  if (loginErr) loginErr.style.display = 'none';

  try {
    showToast('Connecting to Google SSO...', 'info');
    const session = await loginWithGoogle();
    showToast(`Welcome back, ${session.name}!`, 'success');
    setTimeout(() => window.location.reload(), 600);
  } catch (err) {
    if (loginErr) {
      loginErr.textContent = err.message || 'Google Login failed.';
      loginErr.style.display = 'block';
    } else {
      showToast(err.message || 'Google Login failed', 'danger');
    }
  }
};
window.handleLoginSubmit = async (e) => {
  if (e) e.preventDefault();
  const email = document.getElementById('loginEmail')?.value;
  const pass = document.getElementById('loginPass')?.value;
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.style.display = 'none';

  try {
    const session = await loginAdmin(email, pass);
    showToast(`Welcome back, ${session.name || 'Admin'}!`, 'success');
    initAdminUI(session);
    await refreshCurrentView();
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Invalid Credentials';
      errEl.style.display = 'block';
    } else {
      showToast(err.message || 'Invalid Credentials', 'danger');
    }
  }
};

window.handleAddAllowedEmail = async () => {
  const input = document.getElementById('newAllowedEmailInput');
  const email = input?.value?.trim()?.toLowerCase();
  if (!email) {
    showToast('Please enter a valid Google email address', 'warning');
    return;
  }
  await addAllowedAdminEmail(email);
  showToast(`Email ${email} authorized & saved to cloud!`, 'success');
  if (input) input.value = '';
  renderSettingsView();
};

window.handleRemoveAllowedEmail = async (email) => {
  try {
    await removeAllowedAdminEmail(email);
    showToast(`Access revoked for ${email}`, 'info');
    renderSettingsView();
  } catch (err) {
    showToast(err.message || 'Action failed', 'danger');
  }
};


// Real-Time Application State
let currentView = 'dashboard';
let state = {
  registrations: [],
  customers: [],
  products: DEFAULT_CATALOG_PRODUCTS || [],
  support: [],
  claims: [],
  activity: [],
  filters: { search: '', status: 'All', page: 1, pageSize: 8 }
};

// -------------------------------------------------------------
// SPA Navigation & Data Refresh (Hoisted Function Declarations)
// -------------------------------------------------------------
function renderCurrentView() {
  switch (currentView) {
    case 'dashboard': renderDashboardView(); break;
    case 'customers': renderCustomersView(); break;
    case 'products': renderProductsView(); break;
    case 'registrations': renderRegistrationsView(); break;
    case 'support': renderSupportView(); break;
    case 'claims': renderClaimsView(); break;
    case 'analytics': renderAnalyticsView(); break;
    case 'settings': renderSettingsView(); break;
    case 'marketplaces': renderMarketplacesView(); break;
    default: renderDashboardView();
  }
}
window.renderCurrentView = renderCurrentView;

async function refreshCurrentView() {
  try {
    const results = await Promise.allSettled([
      getRegistrations(), getCustomers(), getProducts(), getSupportTickets(), getClaims(), getRecentActivity()
    ]);

    state.registrations = results[0].status === 'fulfilled' ? (results[0].value || []) : [];
    state.customers     = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
    state.products      = results[2].status === 'fulfilled' ? (results[2].value || []) : [];
    state.support       = results[3].status === 'fulfilled' ? (results[3].value || []) : [];
    state.claims        = results[4].status === 'fulfilled' ? (results[4].value || []) : [];
    state.activity      = results[5].status === 'fulfilled' ? (results[5].value || []) : [];
  } catch (e) {
    console.warn('Refresh view exception, using current state:', e);
  }

  const pendingCount = (state.registrations || []).filter(r => r.status === 'Pending').length;
  const badgeEl = document.getElementById('sidebarPendingBadge');
  if (badgeEl) {
    if (pendingCount > 0) {
      badgeEl.textContent = pendingCount;
      badgeEl.style.display = 'inline-block';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  renderCurrentView();
}
window.refreshCurrentView = refreshCurrentView;

async function navigateTo(viewName) {
  currentView = viewName;
  state.filters.search = '';
  state.filters.status = 'All';
  state.filters.page = 1;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewName);
  });

  const titles = {
    dashboard: 'Dashboard Overview',
    customers: 'Customer Directory',
    products: 'Product Catalog Management',
    registrations: 'Product Registrations',
    support: 'Support Desk & Tickets',
    claims: 'Warranty Claims Portal',
    analytics: 'Analytics & Performance Insights',
    settings: 'System Configuration',
    marketplaces: 'Marketplace Management'
  };
  const titleEl = document.getElementById('viewTitle');
  if (titleEl) titleEl.textContent = titles[viewName] || 'Executive Dashboard';

  renderCurrentView();
  await refreshCurrentView();
}
window.navigateTo = navigateTo;

// Global High-Res Lightbox Invoice Viewer
function viewInvoicePhoto(url) {
  if (!url) {
    showToast('No invoice file attached to this registration', 'info');
    return;
  }
  const isImg = url.startsWith('data:image') || url.match(/\.(jpg|jpeg|png|webp)($|\?)/i) || url.includes('/file/');

  showModal({
    title: '<span style="display:flex;align-items:center;gap:8px;"><i class="ti ti-photo" style="color:var(--primary);font-size:20px;"></i> <span>Uploaded Invoice Photo Document</span></span>',
    maxWidth: '680px',
    confirmText: '',
    cancelText: 'Close',
    bodyHtml: `
      <div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid var(--border-color);">
        ${isImg ? `
          <div style="position:relative;display:inline-block;max-width:100%;">
            <img src="${url}" alt="Invoice Photo" style="max-width:100%;max-height:480px;border-radius:8px;object-fit:contain;box-shadow:0 4px 16px rgba(0,0,0,0.12);border:1px solid #e2e8f0;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'600\\' height=\\'400\\' viewBox=\\'0 0 600 400\\'><rect width=\\'600\\' height=\\'400\\' fill=\\'%230f172a\\' rx=\\'16\\'/><rect x=\\'40\\' y=\\'40\\' width=\\'520\\' height=\\'320\\' fill=\\'%231e293b\\' rx=\\'12\\' stroke=\\'%23334155\\' stroke-width=\\'2\\'/><text x=\\'70\\' y=\\'90\\' fill=\\'%2338bdf8\\' font-family=\\'sans-serif\\' font-size=\\'22\\' font-weight=\\'bold\\'>SpinBot Warranty Invoice Document</text><text x=\\'70\\' y=\\'130\\' fill=\\'%2394a3b8\\' font-family=\\'sans-serif\\' font-size=\\'14\\'>Invoice Verification Receipt · Official Copy</text><line x1=\\'70\\' y1=\\'150\\' x2=\\'530\\' y2=\\'150\\' stroke=\\'%23334155\\' stroke-width=\\'1\\'/><text x=\\'70\\' y=\\'190\\' fill=\\'%23f8fafc\\' font-family=\\'sans-serif\\' font-size=\\'16\\'>Product: SpinBot Gaming Accessory</text><text x=\\'70\\' y=\\'220\\' fill=\\'%23f8fafc\\' font-family=\\'sans-serif\\' font-size=\\'16\\'>Status: Verified Purchase Document</text><text x=\\'70\\' y=\\'250\\' fill=\\'%23f8fafc\\' font-family=\\'sans-serif\\' font-size=\\'16\\'>Channel: Authorized SpinBot Retailer</text><rect x=\\'70\\' y=\\'280\\' width=\\'140\\' height=\\'36\\' fill=\\'%2310b981\\' rx=\\'8\\'/><text x=\\'140\\' y=\\'303\\' fill=\\'%23ffffff\\' font-family=\\'sans-serif\\' font-size=\\'13\\' font-weight=\\'bold\\' text-anchor=\\'middle\\'>VERIFIED</text></svg>';"/>
          </div>
        ` : `
          <iframe src="${url}" style="width:100%;height:450px;border:none;border-radius:8px;"></iframe>
        `}
        <div style="margin-top:16px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">
          <a href="${url}" target="_blank" download class="btn btn-primary btn-sm">
            <i class="ti ti-download"></i> Download Photo
          </a>
          <a href="${url}" target="_blank" class="btn btn-secondary btn-sm">
            <i class="ti ti-external-link"></i> Open Full View
          </a>
        </div>
      </div>
    `
  });
}
window.viewInvoicePhoto = viewInvoicePhoto;

// -------------------------------------------------------------
// Initialize App & Auth Verification (Strict Lock)
// -------------------------------------------------------------
function startApp() {
  const session = checkAdminAuth();
  const overlay = document.getElementById('loginOverlay');

  if (!session) {
    if (overlay) overlay.classList.add('active');
    return; // Strictly block dashboard initialization until login!
  }

  initAdminUI(session);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

function initAdminUI(session) {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.remove('active');

  const nameEl = document.getElementById('adminNameDisplay');
  const roleEl = document.getElementById('adminRoleDisplay');
  const avatarEl = document.getElementById('adminAvatar');

  if (nameEl) nameEl.textContent = session.name || session.email || 'SpinBot Admin';
  if (roleEl) roleEl.textContent = session.role || 'Super Admin';
  if (avatarEl) avatarEl.textContent = (session.name || session.email || 'A').charAt(0).toUpperCase();

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('globalSearch')?.focus();
    }
  });

  // Global click delegation for sidebar navigation
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item[data-view]');
    if (navItem) {
      e.preventDefault();
      const view = navItem.getAttribute('data-view');
      if (view && window.navigateTo) {
        window.navigateTo(view);
      }
    }
  });

  // Instantly render current view
  currentView = 'dashboard';
  renderCurrentView();

  // Subscribe to Live Real-Time Firestore Registrations Update
  subscribeToRegistrations((regs) => {
    state.registrations = regs;
    renderCurrentView();
  });

  // Subscribe to Live Real-Time Firestore Customers Update
  subscribeToCustomers((custs) => {
    state.customers = custs;
    renderCurrentView();
  });

  // Async sync products & auxiliary data
  refreshCurrentView().catch(() => {});
}

window.handleLoginSubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const loginBtn = document.getElementById('loginBtn');
  const errDiv = document.getElementById('loginError');

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="ti ti-loader spin"></i> Authenticating...';
  if (errDiv) errDiv.style.display = 'none';

  try {
    const session = await loginAdmin(email, pass);
    initAdminUI(session);
    showToast('Welcome back to Product Registration Admin!', 'success');
  } catch (err) {
    if (errDiv) {
      errDiv.textContent = err.message || 'Access Denied! Invalid credentials.';
      errDiv.style.display = 'block';
    } else {
      showToast(err.message || 'Access Denied!', 'danger');
    }
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Sign In to Product Registration Admin <i class="ti ti-arrow-right"></i>';
  }
};

window.handleLogout = async () => {
  await logoutAdmin();
  document.getElementById('loginOverlay')?.classList.add('active');
  showToast('Logged out successfully', 'info');
};



window.handleGlobalSearch = (q) => {
  state.filters.search = q;
  state.filters.page = 1;
  if (currentView === 'registrations') renderRegistrationsView();
  else if (currentView === 'customers') renderCustomersView();
  else if (currentView === 'products') renderProductsView();
};

// -------------------------------------------------------------
// 1. DASHBOARD VIEW
// -------------------------------------------------------------
function renderDashboardView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  const regs = state.registrations || [];
  const custs = state.customers || [];
  const prods = state.products || [];

  const totalRegs = regs.length;
  const activeRegs = regs.filter(r => r.status === 'Active' || (r.daysRemaining > 0 && r.status !== 'Rejected')).length;
  const pendingRegs = regs.filter(r => r.status === 'Pending').length;
  const expiredRegs = regs.filter(r => r.status === 'Expired' || r.daysRemaining === 0).length;

  container.innerHTML = `
    <!-- Metric Cards -->
    <div class="stat-grid">
      <div class="stat-card" style="--stat-accent: #3b82f6;">
        <div class="stat-header">
          <span class="stat-title">Total Customers</span>
          <div class="stat-icon" style="background: #eff6ff; color: #3b82f6;"><i class="ti ti-users"></i></div>
        </div>
        <div class="stat-value">${custs.length}</div>
        <div class="stat-trend up"><i class="ti ti-trending-up"></i> Active Users</div>
      </div>

      <div class="stat-card" style="--stat-accent: #8b5cf6;">
        <div class="stat-header">
          <span class="stat-title">Total Products</span>
          <div class="stat-icon" style="background: #f5f3ff; color: #8b5cf6;"><i class="ti ti-package"></i></div>
        </div>
        <div class="stat-value">${prods.length}</div>
        <div class="stat-trend neutral"><i class="ti ti-package"></i> Catalog Active</div>
      </div>

      <div class="stat-card" style="--stat-accent: #06b6d4;">
        <div class="stat-header">
          <span class="stat-title">Total Registrations</span>
          <div class="stat-icon" style="background: #ecfeff; color: #06b6d4;"><i class="ti ti-file-certificate"></i></div>
        </div>
        <div class="stat-value">${totalRegs}</div>
        <div class="stat-trend up"><i class="ti ti-trending-up"></i> Total Registered</div>
      </div>

      <div class="stat-card" style="--stat-accent: #10b981;">
        <div class="stat-header">
          <span class="stat-title">Active Warranty</span>
          <div class="stat-icon" style="background: #f0fdf4; color: #10b981;"><i class="ti ti-shield-check"></i></div>
        </div>
        <div class="stat-value">${activeRegs}</div>
        <div class="stat-trend up"><i class="ti ti-shield"></i> Valid Coverage</div>
      </div>

      <div class="stat-card" style="--stat-accent: #ef4444;">
        <div class="stat-header">
          <span class="stat-title">Expired Warranty</span>
          <div class="stat-icon" style="background: #fef2f2; color: #ef4444;"><i class="ti ti-shield-x"></i></div>
        </div>
        <div class="stat-value">${expiredRegs}</div>
        <div class="stat-trend down"><i class="ti ti-clock-off"></i> Expired</div>
      </div>

      <div class="stat-card" style="--stat-accent: #f59e0b;">
        <div class="stat-header">
          <span class="stat-title">Pending Approval</span>
          <div class="stat-icon" style="background: #fffbeb; color: #f59e0b;"><i class="ti ti-clock"></i></div>
        </div>
        <div class="stat-value">${pendingRegs}</div>
        <div class="stat-trend neutral"><i class="ti ti-alert-circle"></i> Needs Review</div>
      </div>
    </div>

    <!-- Recent Registrations & Activity -->
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
      <div class="card-table-wrapper">
        <div class="toolbar">
          <div style="font-weight: 800; font-size: 15px; color: var(--text-main);">Recent Registrations</div>
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('registrations')">View All</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Warranty ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Status</th>
                <th>Invoice Photo</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${regs.length > 0 ? regs.slice(0, 5).map(r => `
                <tr onclick="openWarrantyDetails('${r.id}')">
                  <td><strong>${r.warrantyId || r.id}</strong></td>
                  <td>
                    <div style="display: flex; align-items: center;">
                      <div class="user-avatar-tag">${(r.fullName || 'A').charAt(0).toUpperCase()}</div>
                      ${r.fullName}
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      ${(r.productImage || r.image) ? `
                        <img src="${r.productImage || r.image}" alt="${r.product}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink: 0;"/>
                      ` : `
                        <div style="width: 32px; height: 32px; border-radius: 6px; background: #eff6ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #dbeafe;">
                          <i class="ti ti-package" style="color: #2563eb; font-size: 16px;"></i>
                        </div>
                      `}
                      <span style="font-weight: 600; color: #0f172a;">${r.product}</span>
                    </div>
                  </td>
                  <td>${renderStatusBadge(r.status)}</td>
                  <td>
                    ${r.invoiceUrl ? `
                      <button class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;font-size:11.5px;" onclick="event.stopPropagation(); viewInvoicePhoto('${r.invoiceUrl}')">
                        <i class="ti ti-photo" style="color:var(--primary);font-size:13px;"></i> View Photo
                      </button>
                    ` : '<span style="color:var(--text-light);font-size:11.5px;">No Photo</span>'}
                  </td>
                  <td>
                    ${r.status === 'Pending' ? `
                      <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); quickApprove('${r.id}')">Approve</button>
                    ` : '<span style="color: var(--text-light); font-size: 12.5px;">Verified</span>'}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="ti ti-file-certificate" style="font-size: 32px; display: block; margin-bottom: 8px; color: var(--primary);"></i>
                    <div style="font-weight: 700; font-size: 14px;">No Real Warranty Registrations Yet</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px; margin-bottom: 12px;">Submit a registration from step3-details.html to see live data appear in real time!</div>
                    <a href="step3-details.html" target="_blank" class="btn btn-primary btn-sm"><i class="ti ti-plus"></i> Submit Live Registration</a>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-table-wrapper">
        <div class="toolbar">
          <div style="font-weight: 800; font-size: 15px; color: var(--text-main);">New Customers</div>
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('customers')">Directory</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${custs.slice(0, 5).map(c => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center;">
                      <div class="user-avatar-tag">${(c.name || 'C').charAt(0).toUpperCase()}</div>
                      <strong>${c.name}</strong>
                    </div>
                  </td>
                  <td>${c.phone}</td>
                  <td>${renderStatusBadge(c.status || 'Active')}</td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-light);">No customer records.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

window.quickApprove = async (id) => {
  await updateRegistrationStatus(id, 'Active');
  showToast('Registration approved successfully', 'success');
  refreshCurrentView();
};

// -------------------------------------------------------------
// 2. CUSTOMERS VIEW
// -------------------------------------------------------------
function renderCustomersView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  let list = state.customers || [];

  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)) || c.phone.includes(q));
  }

  const pageSize = state.filters.pageSize || 10;
  const page = state.filters.page || 1;
  const paginated = list.slice((page - 1) * pageSize, page * pageSize);

  container.innerHTML = `
    <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">Customer</h2>
        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">View, add and manage all your customers</div>
      </div>
      <button class="btn btn-primary" onclick="openAddCustomerModal()" style="padding: 9px 18px; font-weight: 700;">
        <i class="ti ti-plus"></i> Add Customer
      </button>
    </div>

    <div class="card-table-wrapper">
      <div class="toolbar" style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
        <div class="toolbar-left" style="display: flex; align-items: center; gap: 12px;">
          <div class="table-search">
            <i class="ti ti-search"></i>
            <input type="text" placeholder="Search customer name, email, phone..." value="${state.filters.search}" oninput="state.filters.search = this.value; state.filters.page = 1; renderCustomersView();"/>
          </div>
          <button class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <i class="ti ti-adjustments-horizontal"></i> Status ▾
          </button>
        </div>

        <div class="toolbar-right" style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 12.5px; color: #64748b; font-weight: 600;">${list.length} Total Customers</span>
          <button class="btn btn-secondary btn-sm" onclick="exportCustomersCSV()">
            <i class="ti ti-download"></i> Export
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Source</th>
              <th>Created On</th>
            </tr>
          </thead>
          <tbody>
            ${paginated.map(c => `
              <tr onclick="openCustomerDetails('${c.phone}', '${c.name}')" style="cursor: pointer;">
                <td>
                  <strong style="color: #2563eb; font-weight: 700;">${c.name}</strong>
                </td>
                <td style="color: #64748b;">${c.email || '—'}</td>
                <td style="font-family: monospace; font-size: 12.5px;">${c.phone}</td>
                <td><span class="badge badge-active">Active</span></td>
                <td><span style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px;">web</span></td>
                <td style="color: #64748b; font-size: 12.5px;">${formatDate(c.createdDate || c.createdAt)}</td>
              </tr>
            `).join('') || `
              <tr>
                <td colspan="6" style="text-align: center; padding: 40px 20px; color: #64748b;">
                  <i class="ti ti-users" style="font-size: 32px; display: block; margin-bottom: 8px; color: #3b82f6;"></i>
                  <div style="font-weight: 700; font-size: 14px;">No customer records found</div>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Submit a registration from step3-details.html to automatically create customer records.</div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="table-footer" id="custPagination"></div>
    </div>
  `;

  renderPaginationContainer(
    document.getElementById('custPagination'),
    list.length, pageSize, page,
    (newPage) => { state.filters.page = newPage; renderCustomersView(); }
  );
}

window.openAddCustomerModal = () => {
  showModal({
    title: 'Add New Customer Profile',
    bodyHtml: `
      <form id="addCustForm">
        <div class="form-group">
          <label class="form-label">Full Name <span class="req">*</span></label>
          <input type="text" id="cName" class="form-control" placeholder="Chandra bhan" required pattern="[A-Za-z\\s]+" oninput="this.value = this.value.replace(/[^a-zA-Z\\s]/g, '')"/>
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number <span class="req">*</span></label>
          <input type="tel" id="cPhone" class="form-control" placeholder="10-digit mobile number" maxlength="10" required pattern="[0-9]{10}" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10)"/>
        </div>
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" id="cEmail" class="form-control" placeholder="bhan33129@gmail.com"/>
        </div>
      </form>
    `,
    confirmText: 'Create Customer',
    onConfirm: async () => {
      const name = document.getElementById('cName').value.trim();
      const phone = document.getElementById('cPhone').value.trim();
      const email = document.getElementById('cEmail').value.trim();

      if (!name || !/^[a-zA-Z\s]+$/.test(name)) {
        showToast('Please enter a valid customer name (alphabets only)', 'warning');
        return false;
      }

      if (!phone || !/^[0-9]{10}$/.test(phone)) {
        showToast('Please enter a valid 10-digit phone number', 'warning');
        return false;
      }

      await upsertCustomer({ name, phone, email });
      showToast('Customer profile created', 'success');
      refreshCurrentView();
    }
  });
};

window.exportCustomersCSV = () => {
  const headers = ['Name', 'Email', 'Phone', 'Status', 'Source', 'Created Date'];
  const rows = (state.customers || []).map(c => [
    c.name, c.email || '', c.phone, c.status || 'Active', 'web', formatDate(c.createdDate || c.createdAt)
  ]);
  exportToCSV('spinbot_customers_directory.csv', headers, rows);
};

// -------------------------------------------------------------
// 3. PRODUCTS VIEW (DYRECT SCREENSHOT 3 & 4 MATCH)
// -------------------------------------------------------------
function renderProductsView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  let list = state.products || [];

  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
  }

  const activeTab = state.filters.productTab || 'All';
  if (activeTab === 'Active') {
    list = list.filter(p => (p.status || 'Active') === 'Active');
  } else if (activeTab === 'Drafts') {
    list = list.filter(p => p.status === 'Draft');
  } else if (activeTab === 'Archived') {
    list = list.filter(p => p.status === 'Archived');
  }

  container.innerHTML = `
    <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">Products</h2>
        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">View, add and manage all your products</div>
      </div>
      <button class="btn btn-primary" onclick="openAddProductModal()" style="padding: 9px 18px; font-weight: 700;">
        <i class="ti ti-plus"></i> Product
      </button>
    </div>

    <div class="card-table-wrapper">
      <div class="toolbar" style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
        <div class="toolbar-left" style="display: flex; align-items: center; gap: 14px;">
          <div class="table-search">
            <i class="ti ti-search"></i>
            <input type="text" placeholder="Search Product Name, SKU..." value="${state.filters.search}" oninput="state.filters.search = this.value; renderProductsView();"/>
          </div>

          <div style="display: flex; gap: 4px; background: #f1f5f9; padding: 3px; border-radius: 8px;">
            ${['All', 'Active', 'Drafts', 'Archived'].map(tab => `
              <button style="border:none; background:${activeTab === tab ? '#ffffff' : 'transparent'}; color:${activeTab === tab ? '#2563eb' : '#64748b'}; font-weight:${activeTab === tab ? '700' : '600'}; font-size:12.5px; padding: 5px 12px; border-radius: 6px; cursor: pointer;" onclick="state.filters.productTab = '${tab}'; renderProductsView();">
                ${tab}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="toolbar-right" style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 12.5px; color: #64748b; font-weight: 600;">${list.length} of ${state.products.length} Products</span>
          <button class="btn btn-secondary btn-sm" onclick="exportProductsCSV()"><i class="ti ti-download"></i> Export</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 36px;"><input type="checkbox"/></th>
              <th>Product Name</th>
              <th>Sku ID</th>
              <th>Status</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Warranty</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => `
              <tr style="cursor: pointer; transition: background 0.15s ease;" 
                  onclick="openEditProductModal('${p.id}')"
                  onmouseover="this.style.background='rgba(118,211,0,0.06)'" 
                  onmouseout="this.style.background='transparent'">
                <td onclick="event.stopPropagation()"><input type="checkbox"/></td>
                <td>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 8px; background: #eff6ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #dbeafe; overflow: hidden;">
                      ${(p.image || p.productImage) ? `
                        <img src="${p.image || p.productImage}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;"/>
                      ` : `
                        <i class="ti ti-package" style="color: #76D300; font-size: 20px;"></i>
                      `}
                    </div>
                    <div>
                      <strong style="color: #0f172a; font-weight: 700; display: block;">${p.name}</strong>
                      <span style="font-size: 11px; color: #76D300; font-weight: 600;">Click row to edit product</span>
                    </div>
                  </div>
                </td>
                <td><code style="font-size: 12px; color: #2563eb; font-weight: 700; background: #eff6ff; padding: 2px 8px; border-radius: 6px;">${p.sku || 'N/A'}</code></td>
                <td>
                  <span class="badge ${p.status === 'Inactive' ? 'badge-cancelled' : 'badge-active'}">${p.status || 'Active'}</span>
                </td>
                <td><span style="font-weight: 600; color: #334155;">${p.brand || 'SpinBot'}</span></td>
                <td><span style="background: #f1f5f9; color: #475569; font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">${p.category || 'Coolers'}</span></td>
                <td style="font-weight: 700; color: #0f172a;">${p.warrantyPeriod || '12 Months'}</td>
                <td style="text-align: right;" onclick="event.stopPropagation()">
                  <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                    <button class="btn btn-ghost btn-sm" onclick="openEditProductModal('${p.id}')" title="Edit Product" style="padding: 5px 10px; color: #2563eb; font-weight: 700;">
                      <i class="ti ti-edit" style="font-size: 16px;"></i> Edit
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="confirmDeleteProduct('${p.id}')" title="Delete Product" style="padding: 5px 8px; color: #ef4444;">
                      <i class="ti ti-trash" style="font-size: 16px;"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="8" style="text-align:center; padding: 30px; color: #64748b;">No products match criteria.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

let currentUploadedProductImg = '';

function handleProductImgSelect(e) {
  const file = e.target.files ? e.target.files[0] : null;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    currentUploadedProductImg = evt.target.result || '';
    const imgPreview = document.getElementById('pImgPreview');
    const container = document.getElementById('pImgPreviewBox');
    const placeholder = document.getElementById('pImgPlaceholderBox');

    if (imgPreview && container && placeholder) {
      imgPreview.src = currentUploadedProductImg;
      container.style.display = 'block';
      placeholder.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}
window.handleProductImgSelect = handleProductImgSelect;

function removeProductImg(e) {
  if (e) e.stopPropagation();
  currentUploadedProductImg = '';
  const container = document.getElementById('pImgPreviewBox');
  const placeholder = document.getElementById('pImgPlaceholderBox');
  const fileInput = document.getElementById('pImgFileInput');

  if (container && placeholder) {
    container.style.display = 'none';
    placeholder.style.display = 'flex';
  }
  if (fileInput) fileInput.value = '';
}
window.removeProductImg = removeProductImg;

function openAddProductModal() {
  window._tempAddImg = '';

  showModal({
    title: '<span style="display:flex;align-items:center;gap:8px;"><i class="ti ti-plus" style="color:var(--primary);font-size:20px;"></i> Add New Product to Catalog</span>',
    maxWidth: '740px',
    confirmText: 'Save Product to Catalog',
    cancelText: 'Cancel',
    bodyHtml: `
      <form id="addProdForm" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 16px; align-items: start;">
          <!-- Product Photo Upload / Dropzone -->
          <div id="apImgDropZone" onclick="document.getElementById('apImgFileInput').click()" style="border: 2px dashed #76D300; border-radius: 12px; height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8px; cursor: pointer; background: rgba(118,211,0,0.05); position: relative; overflow: hidden;">
            <input type="file" id="apImgFileInput" accept="image/*" style="display:none;" onchange="
              const file = this.files[0];
              if(file){
                const r = new FileReader();
                r.onload = e => {
                  const rawUrl = e.target.result;
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > 400 || h > 400) {
                      if (w > h) { h = Math.round((h * 400) / w); w = 400; }
                      else { w = Math.round((w * 400) / h); h = 400; }
                    }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const compressed = canvas.toDataURL('image/jpeg', 0.8);
                    document.getElementById('apImgPreview').src = compressed;
                    document.getElementById('apImgPreviewBox').style.display = 'block';
                    document.getElementById('apImgPlaceholderBox').style.display = 'none';
                    window._tempAddImg = compressed;
                  };
                  img.src = rawUrl;
                };
                r.readAsDataURL(file);
              }
            "/>
            
            <div id="apImgPreviewBox" style="display:none; width:100%; height:100%; position:relative;">
              <img id="apImgPreview" src="" alt="Product Preview" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"/>
            </div>

            <div id="apImgPlaceholderBox" style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <i class="ti ti-cloud-upload" style="font-size: 24px; color: #76D300; margin-bottom: 4px;"></i>
              <span style="font-size: 11px; color: #0f172a; font-weight: 700;">Upload Photo</span>
            </div>
          </div>

          <!-- Basic Fields -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700;">Product Name <span style="color:var(--g-red)">*</span></label>
              <input type="text" id="apName" class="form-control" placeholder="e.g. SpinBot IceDot Mag v1 Mobile Cooler"/>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 700;">SKU ID <span style="color:var(--g-red)">*</span></label>
                <input type="text" id="apSku" class="form-control" placeholder="e.g. SB-ICEDOT-MAG1"/>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 700;">Category</label>
                <select id="apCategory" class="form-select" onchange="
                  const customInp = document.getElementById('apCustomCategory');
                  if(this.value === 'CUSTOM') { customInp.style.display = 'block'; customInp.focus(); }
                  else { customInp.style.display = 'none'; }
                ">
                  <option value="Coolers">Coolers</option>
                  <option value="Gaming Triggers">Gaming Triggers</option>
                  <option value="Earphones & Headphones">Earphones &amp; Headphones</option>
                  <option value="Laptop Cooling">Laptop Cooling</option>
                  <option value="Keyboards">Keyboards</option>
                  <option value="Accessories" selected>Accessories</option>
                  <option value="CUSTOM">+ Write / Add New Category...</option>
                </select>
                <input type="text" id="apCustomCategory" class="form-control" placeholder="Type custom category name..." style="display:none; margin-top:6px;"/>
              </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Brand</label>
            <input type="text" id="apBrand" class="form-control" value="SpinBot"/>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Warranty Period</label>
            <select id="apWarranty" class="form-select">
              <option value="1 Month">1 Month</option>
              <option value="3 Months">3 Months</option>
              <option value="6 Months">6 Months</option>
              <option value="12 Months" selected>12 Months (1 Year)</option>
              <option value="18 Months">18 Months</option>
              <option value="24 Months">24 Months (2 Years)</option>
              <option value="36 Months">36 Months (3 Years)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Catalog Status</label>
            <select id="apStatus" class="form-select">
              <option value="Active" selected>Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </form>
    `,
    onConfirm: async () => {
      const name = document.getElementById('apName').value.trim();
      const sku = document.getElementById('apSku').value.trim();
      let category = document.getElementById('apCategory').value;
      if (category === 'CUSTOM') {
        category = document.getElementById('apCustomCategory').value.trim() || 'Custom Category';
      }
      const brand = document.getElementById('apBrand').value.trim() || 'SpinBot';
      const warrantyPeriod = document.getElementById('apWarranty').value || '12 Months';
      const status = document.getElementById('apStatus').value || 'Active';
      const image = window._tempAddImg || 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=150&auto=format&fit=crop&q=80';

      if (!name || !sku) {
        showToast('Please enter both Product Name and SKU ID', 'warning');
        return false;
      }

      const newProd = await addProduct({
        name,
        sku,
        brand,
        category,
        warrantyPeriod,
        description: `${brand} ${name} product item in ${category} category`,
        image,
        status
      });

      if (state.products) {
        state.products.unshift(newProd);
      }
      window._tempAddImg = '';
      showToast(`Product "${name}" added to catalog!`, 'success');
      renderProductsView();

      // Show Success Pop-Up Dialog Modal
      setTimeout(() => {
        showModal({
          title: '<span style="display:flex;align-items:center;gap:8px;color:#137333;"><i class="ti ti-circle-check" style="font-size:24px;"></i> Product Added Successfully!</span>',
          maxWidth: '480px',
          confirmText: 'Done',
          confirmClass: 'btn-primary',
          cancelText: '',
          bodyHtml: `
            <div style="text-align:center; padding:16px 8px;">
              <div style="width:64px; height:64px; border-radius:50%; background:#e6f4ea; color:#137333; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px;">
                <i class="ti ti-package" style="font-size:32px;"></i>
              </div>
              <h4 style="font-size:17px; font-weight:600; color:var(--g-text-dark); margin-bottom:6px;">${name}</h4>
              <div style="font-size:13px; color:var(--g-text-sub); margin-bottom:16px;">SKU: <strong style="color:#1a73e8; font-family:monospace;">${sku}</strong> &bull; Warranty: <strong>${warrantyPeriod}</strong></div>
              <div style="background:#e6f4ea; border:1px solid #a8dab5; border-radius:12px; padding:12px; font-size:12.5px; color:#137333; font-weight:500;">
                <i class="ti ti-check"></i> Product is now live and active in your catalog database!
              </div>
            </div>
          `
        });
      }, 150);

      return true;
    }
  });
}
window.openAddProductModal = openAddProductModal;

window.exportProductsCSV = () => {
  const headers = ['Product Name', 'SKU ID', 'Status', 'Modules', 'Brand', 'Warranty', 'Last Updated'];
  const rows = (state.products || []).map(p => [
    p.name, p.sku || '', p.status || 'Active', 'Warranty', p.brand || 'SpinBot', p.warrantyPeriod || '1 Year(s)', '18 May 2026'
  ]);
  exportToCSV('spinbot_products_catalog.csv', headers, rows);
};

window.openEditProductModal = (id) => {
  const p = (state.products || []).find(prod => prod.id === id);
  if (!p) return;

  let currentEditImg = p.image || p.productImage || '';

  showModal({
    title: '<span style="display:flex;align-items:center;gap:8px;"><i class="ti ti-edit" style="color:var(--primary);font-size:20px;"></i> Edit Product Details</span>',
    maxWidth: '740px',
    bodyHtml: `
      <form id="editProdForm" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 16px; align-items: start;">
          <!-- Product Photo Upload / Preview -->
          <div id="epImgDropZone" onclick="document.getElementById('epImgFileInput').click()" style="border: 2px dashed #76D300; border-radius: 12px; height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8px; cursor: pointer; background: rgba(118,211,0,0.05); position: relative; overflow: hidden;">
            <input type="file" id="epImgFileInput" accept="image/*" style="display:none;" onchange="
              const file = this.files[0];
              if(file){
                const r = new FileReader();
                r.onload = e => {
                  document.getElementById('epImgPreview').src = e.target.result;
                  document.getElementById('epImgPreviewBox').style.display = 'block';
                  document.getElementById('epImgPlaceholderBox').style.display = 'none';
                  window._tempEditImg = e.target.result;
                };
                r.readAsDataURL(file);
              }
            "/>
            
            <div id="epImgPreviewBox" style="display:${currentEditImg ? 'block' : 'none'}; width:100%; height:100%; position:relative;">
              <img id="epImgPreview" src="${currentEditImg}" alt="Product Preview" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"/>
            </div>

            <div id="epImgPlaceholderBox" style="display:${currentEditImg ? 'none' : 'flex'}; flex-direction:column; align-items:center; justify-content:center;">
              <i class="ti ti-cloud-upload" style="font-size: 24px; color: #76D300; margin-bottom: 4px;"></i>
              <span style="font-size: 11px; color: #0f172a; font-weight: 700;">Change Photo</span>
            </div>
          </div>

          <!-- Basic Fields -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700;">Product Name <span class="req">*</span></label>
              <input type="text" id="epName" class="form-control" value="${p.name}"/>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 700;">SKU ID <span class="req">*</span></label>
                <input type="text" id="epSku" class="form-control" value="${p.sku || ''}"/>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 700;">Category</label>
                <select id="epCategory" class="form-select">
                  <option value="Coolers" ${p.category === 'Coolers' ? 'selected' : ''}>Coolers</option>
                  <option value="Gaming Triggers" ${p.category === 'Gaming Triggers' ? 'selected' : ''}>Gaming Triggers</option>
                  <option value="Earphones & Headphones" ${p.category === 'Earphones & Headphones' ? 'selected' : ''}>Earphones & Headphones</option>
                  <option value="Laptop Cooling" ${p.category === 'Laptop Cooling' ? 'selected' : ''}>Laptop Cooling</option>
                  <option value="Keyboards" ${p.category === 'Keyboards' ? 'selected' : ''}>Keyboards</option>
                  <option value="Accessories" ${(!p.category || p.category === 'Accessories') ? 'selected' : ''}>Accessories</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Brand</label>
            <input type="text" id="epBrand" class="form-control" value="${p.brand || 'SpinBot'}"/>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Warranty Period</label>
            <select id="epWarranty" class="form-select">
              <option value="1 Month" ${p.warrantyPeriod === '1 Month' ? 'selected' : ''}>1 Month</option>
              <option value="3 Months" ${p.warrantyPeriod === '3 Months' ? 'selected' : ''}>3 Months</option>
              <option value="6 Months" ${p.warrantyPeriod === '6 Months' ? 'selected' : ''}>6 Months</option>
              <option value="12 Months" ${(p.warrantyPeriod === '12 Months' || p.warrantyPeriod === '1 Year(s)') ? 'selected' : ''}>12 Months (1 Year)</option>
              <option value="18 Months" ${p.warrantyPeriod === '18 Months' ? 'selected' : ''}>18 Months</option>
              <option value="24 Months" ${(p.warrantyPeriod === '24 Months' || p.warrantyPeriod === '2 Year(s)') ? 'selected' : ''}>24 Months (2 Years)</option>
              <option value="36 Months" ${p.warrantyPeriod === '36 Months' ? 'selected' : ''}>36 Months (3 Years)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Catalog Status</label>
            <select id="epStatus" class="form-select">
              <option value="Active" ${p.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${p.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
      </form>
    `,
    confirmText: 'Save Product Changes',
    onConfirm: async () => {
      const name = document.getElementById('epName').value.trim();
      const sku = document.getElementById('epSku').value.trim();
      const category = document.getElementById('epCategory').value;
      const brand = document.getElementById('epBrand').value.trim();
      const warrantyPeriod = document.getElementById('epWarranty').value;
      const status = document.getElementById('epStatus').value;
      const image = window._tempEditImg || currentEditImg;

      if (!name || !sku) {
        showToast('Product Name and SKU ID are required', 'warning');
        return false;
      }

      await updateProduct(id, { name, sku, category, brand, warrantyPeriod, status, image });
      window._tempEditImg = null;
      showToast(`Product "${name}" updated successfully!`, 'success');
      refreshCurrentView();
    }
  });
};

window.confirmDeleteProduct = (id) => {
  const pObj = (state.products || []).find(p => p.id === id || p.sku === id || p.name === id);
  showModal({
    title: 'Delete Product Item',
    bodyHtml: `<p style="font-size: 13.5px;">Are you sure you want to delete <strong>${pObj ? pObj.name : 'this product'}</strong>? This action cannot be undone.</p>`,
    confirmText: 'Delete',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      await deleteProduct(id, pObj);
      showToast('Product deleted successfully', 'info');
      refreshCurrentView();
    }
  });
};

// -------------------------------------------------------------
// 4. WARRANTY REGISTRATIONS VIEW
// -------------------------------------------------------------
function renderRegistrationsView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  let list = state.registrations || [];

  if (state.filters.status !== 'All') {
    list = list.filter(r => r.status === state.filters.status);
  }
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    list = list.filter(r => 
      (r.warrantyId && r.warrantyId.toLowerCase().includes(q)) ||
      r.fullName.toLowerCase().includes(q) ||
      r.product.toLowerCase().includes(q) ||
      (r.sku && r.sku.toLowerCase().includes(q))
    );
  }

  const pageSize = state.filters.pageSize;
  const page = state.filters.page;
  const paginated = list.slice((page - 1) * pageSize, page * pageSize);

  container.innerHTML = `
    <div class="card-table-wrapper">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="table-search">
            <i class="ti ti-search"></i>
            <input type="text" placeholder="Search Warranty ID, Customer, Product..." value="${state.filters.search}" oninput="state.filters.search = this.value; state.filters.page = 1; renderRegistrationsView();"/>
          </div>
          
          <select class="form-select" style="width: 150px; height: 36px;" onchange="state.filters.status = this.value; state.filters.page = 1; renderRegistrationsView();">
            <option value="All" ${state.filters.status === 'All' ? 'selected' : ''}>All Statuses</option>
            <option value="Pending" ${state.filters.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Active" ${state.filters.status === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Expired" ${state.filters.status === 'Expired' ? 'selected' : ''}>Expired</option>
            <option value="Rejected" ${state.filters.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </div>

        <div class="toolbar-right">
          <button class="btn btn-secondary btn-sm" onclick="exportRegistrationsCSV()">
            <i class="ti ti-file-spreadsheet"></i> Export CSV
          </button>
          <button class="btn btn-primary btn-sm" onclick="exportRegistrationsPDF()">
            <i class="ti ti-file-text"></i> Export PDF
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Warranty ID</th>
              <th>Customer Name</th>
              <th>Status</th>
              <th>Invoice Photo</th>
              <th>Warranty</th>
              <th>Validity</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Reg Date</th>
              <th>SKU</th>
              <th>Product</th>
              <th>Brand</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${paginated.map(r => `
              <tr onclick="openWarrantyDetails('${r.id}')">
                <td><strong style="color: var(--primary);">${r.warrantyId || r.id}</strong></td>
                <td>
                  <div style="display: flex; align-items: center;">
                    <div class="user-avatar-tag">${(r.fullName || 'A').charAt(0).toUpperCase()}</div>
                    ${r.fullName}
                  </div>
                </td>
                <td>${renderStatusBadge(r.status)}</td>
                <td onclick="event.stopPropagation();">
                  ${r.invoiceUrl ? `
                    <button class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;font-size:11.5px;" onclick="viewInvoicePhoto('${r.invoiceUrl}')">
                      <i class="ti ti-photo" style="color:var(--primary);font-size:13px;"></i> View Photo
                    </button>
                  ` : '<span style="color:var(--text-light);font-size:11.5px;">No Photo</span>'}
                </td>
                <td>${r.warrantyPeriod || '12 M'}</td>
                <td>${r.daysRemaining > 0 ? `<strong style="color: var(--success);">${r.daysRemaining} days</strong>` : '<span style="color: var(--danger); font-weight: 600;">Expired</span>'}</td>
                <td>${formatDate(r.startDate || r.purchaseDate)}</td>
                <td>${formatDate(r.endDate)}</td>
                <td>${formatDate(r.createdAt)}</td>
                <td><code>${r.sku || 'N/A'}</code></td>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    ${(r.productImage || r.image) ? `
                      <img src="${r.productImage || r.image}" alt="${r.product}" style="width: 28px; height: 28px; border-radius: 6px; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink: 0;"/>
                    ` : `
                      <div style="width: 28px; height: 28px; border-radius: 6px; background: #eff6ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #dbeafe;">
                        <i class="ti ti-package" style="color: #2563eb; font-size: 14px;"></i>
                      </div>
                    `}
                    <span style="font-weight: 600; color: #0f172a;">${r.product}</span>
                  </div>
                </td>
                <td>${r.brand || 'SpinBot'}</td>
                <td onclick="event.stopPropagation();">
                  ${r.status === 'Pending' ? `
                    <button class="btn btn-success btn-sm" title="Approve" onclick="updateRegStatus('${r.id}', 'Active')"><i class="ti ti-check"></i></button>
                    <button class="btn btn-danger btn-sm" title="Reject" onclick="updateRegStatus('${r.id}', 'Rejected')"><i class="ti ti-x"></i></button>
                  ` : r.status === 'Active' ? `
                    <button class="btn btn-secondary btn-sm" title="Expire" onclick="updateRegStatus('${r.id}', 'Expired')">Expire</button>
                  ` : '<span style="color: var(--text-light); font-size: 12px;">--</span>'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="13" style="text-align:center; padding: 20px; color: var(--text-light);">No registrations found.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="table-footer" id="regPagination"></div>
    </div>
  `;

  renderPaginationContainer(
    document.getElementById('regPagination'),
    list.length, pageSize, page,
    (newPage) => { state.filters.page = newPage; renderRegistrationsView(); }
  );
}

window.updateRegStatus = async (id, newStatus) => {
  await updateRegistrationStatus(id, newStatus);
  showToast(`Registration status set to ${newStatus}`, 'success');
  refreshCurrentView();
};

window.exportRegistrationsCSV = () => {
  const headers = ['Warranty ID', 'Customer Name', 'Status', 'Warranty', 'Validity (Days)', 'Start Date', 'End Date', 'SKU', 'Product', 'Brand'];
  const rows = (state.registrations || []).map(r => [
    r.warrantyId || r.id, r.fullName, r.status, r.warrantyPeriod || '12 Months', r.daysRemaining, r.startDate || r.purchaseDate, r.endDate || '', r.sku || '', r.product, r.brand || 'SpinBot'
  ]);
  exportToCSV('warranty_registrations_export.csv', headers, rows);
};

window.exportRegistrationsPDF = () => {
  const headers = ['Warranty ID', 'Customer', 'Product', 'Status', 'Start Date', 'End Date', 'Days Left'];
  const rows = (state.registrations || []).map(r => [
    r.warrantyId || r.id, r.fullName, r.product, r.status, formatDate(r.startDate || r.purchaseDate), formatDate(r.endDate), `${r.daysRemaining || 0} Days`
  ]);
  exportToPDF('Warranty Registrations Master Report', headers, rows, 'warranty_registrations.pdf');
};

// -------------------------------------------------------------
// 5. HIGH-END WARRANTY & CUSTOMER DETAILS POPUP (DYRECT DRAWER MATCH)
// -------------------------------------------------------------
function openCustomerDetails(phone, name) {
  const regs = state.registrations || [];
  const reg = regs.find(r => r.phone === phone || (r.fullName && r.fullName.toLowerCase() === (name || '').toLowerCase()));
  if (reg) {
    openWarrantyDetails(reg.id || reg.warrantyId);
  } else if (regs.length > 0) {
    openWarrantyDetails(regs[0].id);
  } else {
    showToast(`Customer profile for ${name}`, 'info');
  }
}
window.openCustomerDetails = openCustomerDetails;

function wdTab(btnEl, paneId) {
  const parent = btnEl.parentElement;
  if (parent) {
    parent.querySelectorAll('.dy-tab, .wd-tab').forEach(b => b.classList.remove('active'));
  }
  btnEl.classList.add('active');

  const modalBody = btnEl.closest('.modal-body') || document;
  modalBody.querySelectorAll('.wd-pane').forEach(p => p.style.display = 'none');
  const targetPane = modalBody.querySelector('#' + paneId);
  if (targetPane) {
    targetPane.style.display = 'block';
  }
}
window.wdTab = wdTab;

async function openWarrantyDetails(id) {
  if (!id) return;
  
  let reg = (state.registrations || []).find(r => 
    r.id === id || 
    r.warrantyId === id || 
    (r.id && String(r.id).replace(/^#/, '').toLowerCase() === String(id).replace(/^#/, '').toLowerCase()) ||
    (r.warrantyId && String(r.warrantyId).replace(/^#/, '').toLowerCase() === String(id).replace(/^#/, '').toLowerCase())
  );

  if (!reg) {
    try {
      reg = await getRegistrationById(id);
    } catch(e) {}
  }

  if (!reg) {
    showToast('Could not load registration details for ID: ' + id, 'danger');
    return;
  }

  const fullName = reg.fullName || reg.customerName || reg.name || '—';
  const email = reg.email || reg.customerEmail || '—';
  const phone = reg.phone || reg.customerPhone || '—';
  const product = reg.product || reg.productName || reg.item || 'SpinBot Product';
  const sku = reg.sku || reg.skuId || 'SB-GENERIC';
  const brand = reg.brand || 'SpinBot';
  const warrantyPeriod = reg.warrantyPeriod || '12 Months';
  const purchaseDate = reg.purchaseDate || reg.startDate || reg.createdAt || new Date().toISOString();
  const purchasePlatform = reg.purchasePlatform || reg.platform || 'Direct Store';
  const serialNumber = reg.serialNumber || 'N/A';
  const warrantyId = reg.warrantyId || reg.registrationId || reg.id || 'SB-00000';
  const status = reg.status || 'Active';

  const warrantyMonths = parseInt(warrantyPeriod) || 12;
  let endObj = reg.endDate ? new Date(reg.endDate) : null;
  if (!endObj || isNaN(endObj.getTime())) {
    const pDate = purchaseDate ? new Date(purchaseDate) : new Date();
    endObj = new Date(pDate);
    endObj.setMonth(endObj.getMonth() + warrantyMonths);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = Math.max(0, Math.ceil((endObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const endDate = endObj.toISOString().split('T')[0];
  const progressPercent = daysRemaining > 0 ? Math.min(100, Math.max(5, Math.round((daysRemaining / (warrantyMonths * 30)) * 100))) : 0;

  const pImg = reg.productImage || reg.image;

  showModal({
    title: `
      <div style="display:flex; align-items:center; gap:12px;">
        <i class="ti ti-shield-check" style="color:var(--spin-lime-dark); font-size:22px;"></i>
        <span style="font-size:18px; font-weight:600; color:var(--g-text-dark);">Warranty Details #${warrantyId}</span>
        ${renderStatusBadge(status)}
      </div>
    `,
    maxWidth: '940px',
    confirmText: '',
    cancelText: 'Close',
    bodyHtml: `
      <div style="display: grid; grid-template-columns: 1fr 310px; gap: 24px; text-align: left;">
        <!-- Left Column -->
        <div>
          <!-- Tab Buttons -->
          <div style="display:flex; gap:20px; border-bottom:1px solid var(--g-border); margin-bottom:20px;">
            <button type="button" class="dy-tab active" onclick="wdTab(this,'modalOverview')">Overview</button>
            <button type="button" class="dy-tab" onclick="wdTab(this,'modalSupport')">Support Requests</button>
            <button type="button" class="dy-tab" onclick="wdTab(this,'modalService')">Service Requests</button>
            <button type="button" class="dy-tab" onclick="wdTab(this,'modalAttachments')">Attachments</button>
          </div>

          <!-- Overview Pane -->
          <div id="modalOverview" class="wd-pane">
            <!-- Product Header Box -->
            <div style="display: flex; align-items: center; gap: 16px; background: #ffffff; border: 1px solid var(--g-border); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px;">
              ${pImg ? `
                <img src="${pImg}" alt="${product}" style="width: 56px; height: 56px; border-radius: 10px; object-fit: cover; border: 1px solid var(--g-border); flex-shrink: 0;"/>
              ` : `
                <div style="width: 56px; height: 56px; border-radius: 10px; background: #e8f0fe; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <i class="ti ti-package" style="font-size: 28px; color: #1a73e8;"></i>
                </div>
              `}
              <div>
                <div style="font-size: 16.5px; font-weight: 600; color: var(--g-text-dark);">${product}</div>
                <div style="font-size: 13px; color: var(--g-text-sub); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap;">
                  <span>SKU: <strong style="font-family: monospace; color: #1a73e8;">${sku}</strong></span>
                  <span>Brand: <strong>${brand}</strong></span>
                  <span>Warranty: <strong>${warrantyPeriod}</strong></span>
                </div>
              </div>
            </div>

            <div style="font-size:14.5px; font-weight:600; color:var(--g-text-dark); margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <i class="ti ti-layout-grid" style="color:#1a73e8;"></i> Product Registration Details
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; background:#ffffff; border:1px solid var(--g-border); border-radius:14px; padding:20px;">
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Customer Name</div>
                <div style="font-size:14px; font-weight:500; color:#1a73e8; cursor:pointer;" onclick="openCustomerDetails('${phone}','${fullName}')">${fullName}</div>
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Customer Email</div>
                <div style="font-size:14px; font-weight:500; color:var(--g-text-dark);">${email}</div>
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Phone Number</div>
                <div style="font-size:14px; font-weight:500; color:var(--g-text-dark);">${phone}</div>
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Date of Purchase</div>
                <div style="font-size:14px; font-weight:500; color:var(--g-text-dark);">${formatDate(purchaseDate)}</div>
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Invoice Copy</div>
                ${reg.invoiceUrl ? `
                  <div style="display:inline-flex; align-items:center; gap:10px; padding:8px 12px; background:var(--g-bg); border:1px solid var(--g-border); border-radius:10px; cursor:pointer;" onclick="viewInvoicePhoto('${reg.invoiceUrl}')" title="Click to view full photo invoice">
                    <div style="width:28px; height:28px; border-radius:6px; background:#e6f4ea; color:#137333; display:flex; align-items:center; justify-content:center;">
                      <i class="ti ti-file-text" style="font-size:16px;"></i>
                    </div>
                    <div>
                      <div style="font-size:12px; font-weight:500; color:var(--g-text-dark);">Photo Invoice</div>
                      <div style="font-size:10.5px; color:#137333; font-weight:500;">Click to view</div>
                    </div>
                  </div>
                ` : '<div style="font-size:13.5px; color:var(--g-text-sub); font-style:italic;">No Invoice Uploaded</div>'}
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Purchased Platform</div>
                <div style="font-size:14px; font-weight:500; color:var(--g-text-dark);">${purchasePlatform}</div>
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Serial Number</div>
                <div style="font-size:14px; font-weight:500; color:var(--g-text-dark);">${serialNumber}</div>
              </div>
              <div>
                <div style="font-size:11px; font-weight:600; color:var(--g-text-sub); text-transform:uppercase; margin-bottom:3px;">Product Item</div>
                <div style="font-size:14px; font-weight:500; color:var(--g-text-dark);">${product}</div>
              </div>
            </div>
          </div>

          <div id="modalSupport" class="wd-pane" style="display:none;">
            <div style="padding:32px; text-align:center; color:var(--g-text-sub);">No active support requests for this customer.</div>
          </div>

          <div id="modalService" class="wd-pane" style="display:none;">
            <div style="padding:32px; text-align:center; color:var(--g-text-sub);">No service claims logged.</div>
          </div>

          <div id="modalAttachments" class="wd-pane" style="display:none;">
            ${reg.invoiceUrl ? `
              <div style="text-align:center; padding:20px; background:var(--g-bg); border-radius:12px; border:1px solid var(--g-border);">
                <img src="${reg.invoiceUrl}" alt="Invoice" style="max-width:100%; max-height:350px; border-radius:10px; object-fit:contain; margin-bottom:14px; cursor:pointer;" onclick="viewInvoicePhoto('${reg.invoiceUrl}')"/>
                <div>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="viewInvoicePhoto('${reg.invoiceUrl}')">
                    <i class="ti ti-photo"></i> View High-Res Lightbox
                  </button>
                </div>
              </div>
            ` : '<div style="padding:32px; text-align:center; color:var(--g-text-sub);">No attachments found.</div>'}
          </div>
        </div>

        <!-- Right Column: Status Banner & Properties Card -->
        <div>
          <!-- Green Gradient Gauge Card -->
          <div style="background: linear-gradient(135deg, #10b981, #059669); border-radius: 16px; padding: 20px; color: #ffffff; box-shadow: 0 4px 16px rgba(16,185,129,0.25); margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <span style="font-size: 15px; font-weight: 700;">#${warrantyId}</span>
              <span style="background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;">${status}</span>
            </div>
            <div style="font-size: 28px; font-weight: 700; line-height: 1; margin-bottom: 4px;">${daysRemaining} <span style="font-size: 14px; font-weight: 500;">days left</span></div>
            <div style="font-size: 12px; opacity: 0.9; display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Coverage Ends</span>
              <strong>${formatDate(endDate)}</strong>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.3); border-radius: 10px; overflow: hidden;">
              <div style="height: 100%; background: #ffffff; border-radius: 10px; width: ${progressPercent}%;"></div>
            </div>
          </div>

          <!-- Properties Card -->
          <div style="background: var(--g-bg); border: 1px solid var(--g-border); border-radius: 14px; padding: 18px;">
            <div style="font-size: 13.5px; font-weight: 600; color: var(--g-text-dark); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
              <span>Properties</span>
              <i class="ti ti-chevron-up"></i>
            </div>
            <div style="margin-bottom: 12px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--g-text-sub); display: block; margin-bottom: 4px;">Status</label>
              <select class="form-select" style="font-size: 12.5px; padding: 4px 8px; height: 34px;" onchange="updateRegStatus('${reg.id}', this.value)">
                <option value="Active" ${status === 'Active' ? 'selected' : ''}>Approved / Active</option>
                <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending Approval</option>
                <option value="Expired" ${status === 'Expired' ? 'selected' : ''}>Expired</option>
                <option value="Rejected" ${status === 'Rejected' ? 'selected' : ''}>Rejected</option>
              </select>
            </div>
            <div style="margin-bottom: 12px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--g-text-sub); display: block; margin-bottom: 2px;">Warranty Registration</label>
              <div style="font-size: 13px; font-weight: 500; color: #1a73e8;">#${warrantyId}</div>
            </div>
            <div style="margin-bottom: 12px;">
              <label style="font-size: 11px; font-weight: 600; color: var(--g-text-sub); display: block; margin-bottom: 2px;">Warranty ID</label>
              <div style="font-size: 13px; font-weight: 500; font-family: monospace; color: var(--g-text-dark);">${warrantyId}</div>
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: var(--g-text-sub); display: block; margin-bottom: 2px;">Expires</label>
              <div style="font-size: 12.5px; font-weight: 500; color: var(--g-text-dark);">${formatDate(endDate)} (${daysRemaining} days left)</div>
            </div>
          </div>
        </div>
      </div>
    `
  });
}
window.openWarrantyDetails = openWarrantyDetails;

// -------------------------------------------------------------
// 6. SUPPORT VIEW
// -------------------------------------------------------------
function renderSupportView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  const tickets = state.support || [];

  container.innerHTML = `
    <div class="card-table-wrapper">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="table-search">
            <i class="ti ti-search"></i>
            <input type="text" placeholder="Search Tickets..." oninput="state.filters.search = this.value; renderSupportView();"/>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Customer</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Created Date</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(t => `
              <tr>
                <td><strong>${t.ticketId || t.id}</strong></td>
                <td>${t.customerName}</td>
                <td>${t.subject}</td>
                <td>${renderStatusBadge(t.status)}</td>
                <td>${formatDate(t.createdAt)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-light);">No support tickets.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// 7. CLAIMS VIEW
// -------------------------------------------------------------
function renderClaimsView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  const claims = state.claims || [];

  container.innerHTML = `
    <div class="card-table-wrapper">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="table-search">
            <i class="ti ti-search"></i>
            <input type="text" placeholder="Search Claims..." oninput="state.filters.search = this.value; renderClaimsView();"/>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Claim Number</th>
              <th>Warranty ID</th>
              <th>Customer</th>
              <th>Issue Summary</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${claims.map(c => `
              <tr>
                <td><strong>${c.claimNumber}</strong></td>
                <td><code>${c.warrantyId || 'N/A'}</code></td>
                <td>${c.customer}</td>
                <td>${c.issue}</td>
                <td>${renderStatusBadge(c.status)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-light);">No claims recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// 8. ANALYTICS VIEW (EXECUTIVE PRO WITH DATE FILTERS & HOVER EFFECTS)
// -------------------------------------------------------------
let analyticsTimeframe = 'monthly'; // 'daily' | 'monthly'

function renderAnalyticsView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  const rawRegs = state.registrations || [];
  const custs = state.customers || [];
  const prods = state.products || [];

  // Filter registrations by selected custom date range if set
  let regs = rawRegs;
  if (analyticsCustomStartDate || analyticsCustomEndDate) {
    regs = rawRegs.filter(r => {
      if (!r.createdAt) return true;
      const rDate = new Date(r.createdAt);
      if (isNaN(rDate)) return true;
      if (analyticsCustomStartDate && rDate < analyticsCustomStartDate) return false;
      if (analyticsCustomEndDate) {
        const endDay = new Date(analyticsCustomEndDate);
        endDay.setHours(23, 59, 59, 999);
        if (rDate > endDay) return false;
      }
      return true;
    });
  }

  const pending = regs.filter(r => r.status === 'Pending').length;
  const active = regs.filter(r => r.status === 'Active').length;
  const expired = regs.filter(r => r.status === 'Expired').length;
  const rejected = regs.filter(r => r.status === 'Rejected').length;

  const approvalRate = regs.length > 0 ? Math.round((active / regs.length) * 100) : 100;
  const totalVolume = regs.length;

  // Compute Real-Time Volume Chart Data (Date-wise vs Month-wise)
  let volumeChartData = [];

  if (analyticsTimeframe === 'daily') {
    // 100% Real-Time Last 7 Days Date Grouping
    const last7Days = [];
    const dateCounts = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      last7Days.push(label);
      dateCounts[label] = 0;
    }

    regs.forEach(r => {
      let label = '';
      if (r.createdAt) {
        const d = new Date(r.createdAt);
        if (!isNaN(d)) {
          label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
        }
      }
      if (!label) {
        const today = new Date();
        label = `${today.getDate()} ${today.toLocaleString('default', { month: 'short' })}`;
      }
      if (dateCounts[label] !== undefined) {
        dateCounts[label]++;
      } else {
        dateCounts[label] = 1;
      }
    });

    volumeChartData = Object.keys(dateCounts).slice(-7).map(k => ({ label: k, value: dateCounts[k] }));
  } else {
    // 100% Real-Time Monthly Grouping (Recent 5 Months)
    const monthCounts = {};
    const months = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mLabel = d.toLocaleString('default', { month: 'short' });
      months.push(mLabel);
      monthCounts[mLabel] = 0;
    }

    regs.forEach(r => {
      let mLabel = '';
      if (r.createdAt) {
        const d = new Date(r.createdAt);
        if (!isNaN(d)) mLabel = d.toLocaleString('default', { month: 'short' });
      }
      if (!mLabel) {
        mLabel = new Date().toLocaleString('default', { month: 'short' });
      }
      if (monthCounts[mLabel] !== undefined) {
        monthCounts[mLabel]++;
      } else {
        monthCounts[mLabel] = 1;
      }
    });

    volumeChartData = months.map(m => ({ label: m, value: monthCounts[m] || 0 }));
  }

  // Group by Categories
  const categoryCounts = {};
  regs.forEach(r => {
    const p = prods.find(item => item.name === r.product || item.sku === r.sku);
    const cat = p ? (p.category || 'Other') : 'Gaming Gear';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const catList = Object.keys(categoryCounts).map(cat => ({
    label: cat,
    value: categoryCounts[cat]
  })).sort((a,b) => b.value - a.value);

  // Group by Marketplaces
  const mktCounts = {};
  regs.forEach(r => {
    const platform = r.purchasePlatform || 'SpinBot Store';
    mktCounts[platform] = (mktCounts[platform] || 0) + 1;
  });

  const mktList = Object.keys(mktCounts).map(m => ({
    label: m,
    value: mktCounts[m]
  })).sort((a,b) => b.value - a.value);

  container.innerHTML = `
    <!-- Top Action Bar with Timeframe Toggle & Export Buttons -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">Analytics &amp; Performance Insights</h2>
        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Real-time warranty registration metrics, customer base &amp; growth analytics</div>
      </div>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <!-- Custom Date Range Calendar Inputs -->
        <div style="display: flex; align-items: center; gap: 6px; background: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <i class="ti ti-calendar-event" style="color: #76D300; font-size: 16px;"></i>
          <span style="font-size: 11.5px; font-weight: 700; color: #475569;">From:</span>
          <input type="date" id="analyticsStartDate" class="form-control" style="height: 28px; padding: 2px 6px; font-size: 12px; width: 120px; border: 1px solid #e2e8f0; border-radius: 6px;" 
                 onchange="window._handleDateRangeFilter()"/>
          <span style="font-size: 11.5px; font-weight: 700; color: #475569;">To:</span>
          <input type="date" id="analyticsEndDate" class="form-control" style="height: 28px; padding: 2px 6px; font-size: 12px; width: 120px; border: 1px solid #e2e8f0; border-radius: 6px;" 
                 onchange="window._handleDateRangeFilter()"/>
        </div>

        <!-- Date / Month Filter Toggle -->
        <div style="display: flex; background: #e2e8f0; padding: 3px; border-radius: 10px; gap: 2px;">
          <button type="button" style="border:none; background:${analyticsTimeframe === 'daily' ? '#ffffff' : 'transparent'}; color:${analyticsTimeframe === 'daily' ? '#0f172a' : '#64748b'}; font-weight:${analyticsTimeframe === 'daily' ? '800' : '600'}; font-size:12px; padding:6px 14px; border-radius:8px; cursor:pointer; box-shadow:${analyticsTimeframe === 'daily' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'}; transition:all 0.2s;" 
                  onclick="window._setAnalyticsTimeframe('daily')">
            <i class="ti ti-calendar" style="color:${analyticsTimeframe === 'daily' ? '#76D300' : 'inherit'};"></i> Date-Wise
          </button>
          <button type="button" style="border:none; background:${analyticsTimeframe === 'monthly' ? '#ffffff' : 'transparent'}; color:${analyticsTimeframe === 'monthly' ? '#0f172a' : '#64748b'}; font-weight:${analyticsTimeframe === 'monthly' ? '800' : '600'}; font-size:12px; padding:6px 14px; border-radius:8px; cursor:pointer; box-shadow:${analyticsTimeframe === 'monthly' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'}; transition:all 0.2s;" 
                  onclick="window._setAnalyticsTimeframe('monthly')">
            <i class="ti ti-calendar-stats" style="color:${analyticsTimeframe === 'monthly' ? '#76D300' : 'inherit'};"></i> Month-Wise
          </button>
        </div>

        <button type="button" class="btn btn-secondary" onclick="exportCustomersCSV()" style="font-weight: 700; padding: 9px 16px;">
          <i class="ti ti-users" style="color: #76D300;"></i> Export Customers CSV
        </button>
        <button type="button" class="btn btn-primary" onclick="exportRegistrationsCSV()" style="font-weight: 700; padding: 9px 16px;">
          <i class="ti ti-download"></i> Export Registrations CSV
        </button>
      </div>
    </div>

    <!-- Top KPI Grid -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
      <div class="stat-card" style="--stat-accent: #76D300; background:#fff;">
        <div class="stat-title">Registration Approval Rate</div>
        <div class="stat-value">${approvalRate}%</div>
        <div class="stat-trend up" style="color:#166534;"><i class="ti ti-circle-check-filled"></i> High Verification Ratio</div>
      </div>

      <div class="stat-card" style="--stat-accent: #3b82f6; background:#fff;">
        <div class="stat-title">Total Active Coverage</div>
        <div class="stat-value">${active}</div>
        <div class="stat-trend up"><i class="ti ti-shield-check"></i> Verified Warranties</div>
      </div>

      <div class="stat-card" style="--stat-accent: #f59e0b; background:#fff;">
        <div class="stat-title">Pending Review Queue</div>
        <div class="stat-value">${pending}</div>
        <div class="stat-trend neutral"><i class="ti ti-clock"></i> SLA within 24h</div>
      </div>

      <div class="stat-card" style="--stat-accent: #8b5cf6; background:#fff;">
        <div class="stat-title">Total Customers</div>
        <div class="stat-value">${custs.length || totalVolume}</div>
        <div class="stat-trend up"><i class="ti ti-users"></i> Registered Base</div>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
      <div class="card-table-wrapper" style="padding: 24px; background:#fff;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <div>
            <h3 style="font-size: 15.5px; font-weight: 800; color: #0f172a;">Registration Status Distribution</h3>
            <div style="font-size: 12px; color: #64748b;">Hover segments to inspect live breakdown count &amp; ratio</div>
          </div>
          <span class="badge badge-active">Hover Interactive</span>
        </div>
        <div id="analyticsDonut" style="min-height: 240px;"></div>
      </div>

      <div class="card-table-wrapper" style="padding: 24px; background:#fff;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <div>
            <h3 style="font-size: 15.5px; font-weight: 800; color: #0f172a;">
              ${analyticsTimeframe === 'daily' ? 'Daily Registration Volume (Last 7 Days)' : 'Monthly Volume Trends'}
            </h3>
            <div style="font-size: 12px; color: #64748b;">Registration submissions grouped by ${analyticsTimeframe === 'daily' ? 'date' : 'month'}</div>
          </div>
          <span style="font-size:12px; font-weight:700; color:#76D300; background:rgba(118,211,0,0.12); padding:3px 10px; border-radius:20px;">
            ${analyticsTimeframe === 'daily' ? 'Date-wise View' : 'Month-wise View'}
          </span>
        </div>
        <div id="analyticsBar" style="min-height: 240px;"></div>
      </div>
    </div>

    <!-- Insights Row 2 -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <!-- Category Insights -->
      <div class="card-table-wrapper" style="padding: 24px; background:#fff;">
        <h3 style="font-size: 15.5px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">Top Category Distribution</h3>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${(catList.length > 0 ? catList : [{label: 'Coolers', value: 12}, {label: 'Gaming Triggers', value: 8}]).slice(0, 5).map(c => {
            const pct = Math.round((c.value / (totalVolume || 1)) * 100);
            return `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; color:#0f172a; margin-bottom:4px;">
                  <span>${c.label}</span>
                  <span style="color:#64748b;">${c.value} (${pct}%)</span>
                </div>
                <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                  <div style="width:${Math.max(pct, 12)}%; height:100%; background:var(--gradient-lime); border-radius:4px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Marketplace Channel Performance -->
      <div class="card-table-wrapper" style="padding: 24px; background:#fff;">
        <h3 style="font-size: 15.5px; font-weight: 800; color: #0f172a; margin-bottom: 16px;">Top Purchase Platforms</h3>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${(mktList.length > 0 ? mktList : [{label: 'Amazon', value: 18}, {label: 'SpinBot Store', value: 12}]).slice(0, 5).map(m => {
            const pct = Math.round((m.value / (totalVolume || 1)) * 100);
            return `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:700; color:#0f172a; margin-bottom:4px;">
                  <span>${m.label}</span>
                  <span style="color:#64748b;">${m.value} reg.</span>
                </div>
                <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                  <div style="width:${Math.max(pct, 15)}%; height:100%; background:linear-gradient(90deg, #3b82f6, #60a5fa); border-radius:4px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  renderDonutChart('analyticsDonut', [
    { label: 'Active', value: active || 0, color: '#76D300' },
    { label: 'Pending', value: pending || 0, color: '#f59e0b' },
    { label: 'Expired', value: expired || 0, color: '#ef4444' },
    { label: 'Rejected', value: rejected || 0, color: '#64748b' }
  ]);

  renderBarChart('analyticsBar', volumeChartData);
}

let analyticsCustomStartDate = null;
let analyticsCustomEndDate = null;

window._handleDateRangeFilter = () => {
  const startVal = document.getElementById('analyticsStartDate')?.value;
  const endVal = document.getElementById('analyticsEndDate')?.value;

  if (startVal) analyticsCustomStartDate = new Date(startVal);
  if (endVal) analyticsCustomEndDate = new Date(endVal);

  renderAnalyticsView();
};

window._setAnalyticsTimeframe = (tf) => {
  analyticsTimeframe = tf;
  renderAnalyticsView();
};

// -------------------------------------------------------------
// 9. SETTINGS VIEW
// -------------------------------------------------------------
async function renderSettingsView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;
  await syncAllowedAdminEmailsFromDB();
  const currentMkts = (await getMarketplaces()) || [];

  container.innerHTML = `
    <div class="card-table-wrapper" style="padding: 32px; max-width: 760px; margin: 0 auto;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(118,211,0,0.18); color: #529400; font-size: 22px; display: flex; align-items: center; justify-content: center;">
          <i class="ti ti-settings-2"></i>
        </div>
        <div>
          <h3 style="font-size: 17px; font-weight: 800; color: #0f172a;">Executive System Configurations</h3>
          <div style="font-size: 12.5px; color: #64748b; margin-top: 1px;">Manage brand settings, marketplaces, Cloudflare R2 storage & parameters</div>
        </div>
      </div>

      <!-- MARKETPLACES MANAGEMENT CARD -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 14px;">
          <div>
            <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <i class="ti ti-shopping-cart" style="color: #76D300; font-size: 20px;"></i> Customer Purchase Platforms (Marketplaces)
            </h4>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Add or delete platforms shown to customers on Step 3 registration form dropdown</div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <input type="text" id="newMktInput" class="form-control" placeholder="e.g. Meesho, Tata CLiQ, Reliance Digital..." style="flex:1;"/>
          <button type="button" class="btn btn-primary" onclick="handleAddMarketplace()">
            <i class="ti ti-plus"></i> Add Marketplace
          </button>
        </div>

        <div id="mktListContainer" style="display: flex; flex-wrap: wrap; gap: 10px;">
          ${currentMkts.map(m => `
            <div style="display: inline-flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 20px; padding: 6px 14px; font-size: 13px; font-weight: 700; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <span>${m}</span>
              <button type="button" onclick="handleRemoveMarketplace('${m}')" title="Delete marketplace" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px; padding:0; display:flex; align-items:center; opacity:0.8;">✕</button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- WHITELISTED GOOGLE ADMIN EMAIL ACCOUNTS CARD -->
      <div style="background: #ffffff; border: 1px solid var(--g-border); border-radius: 16px; padding: 22px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(60,64,67,0.08);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 14px;">
          <div>
            <h4 style="font-size: 15px; font-weight: 500; color: var(--g-text-dark); display: flex; align-items: center; gap: 8px;">
              <svg width="20" height="20" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.41-1.57-5.13-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.87 10.78c-.18-.53-.28-1.09-.28-1.78s.1-1.25.28-1.78L.97 4.96C.35 6.19 0 7.56 0 9s.35 2.81.97 4.04l2.9-2.26z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.45 2.02.97 4.96l2.9 2.26C4.59 5.05 6.62 3.58 9 3.58z"/></svg>
              Authorized Google Admin Emails (SSO Whitelist)
            </h4>
            <div style="font-size: 12px; color: var(--g-text-sub); margin-top: 2px;">Manage Google email addresses permitted to sign in via &quot;Continue with Google&quot;. Primary admin (ops.spinbot@gmail.com) is protected.</div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <input type="email" id="newAllowedEmailInput" class="form-control" placeholder="Enter new admin email (e.g. manager@spinbot.co.in)..." style="flex:1;"/>
          <button type="button" class="btn btn-primary" onclick="handleAddAllowedEmail()">
            <i class="ti ti-plus"></i> Authorize Email
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${(window.getAllowedAdminEmails ? window.getAllowedAdminEmails() : ['ops.spinbot@gmail.com']).map(em => `
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--g-bg); border: 1px solid var(--g-border); border-radius: 12px; padding: 10px 16px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <i class="ti ti-mail" style="color: #1a73e8; font-size: 16px;"></i>
                <span style="font-size: 13.5px; font-weight: 500; color: var(--g-text-dark);">${em}</span>
                ${em === 'ops.spinbot@gmail.com' ? '<span style="font-size: 10px; font-weight: 500; background: #e6f4ea; color: #137333; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">Primary Admin</span>' : ''}
              </div>
              ${em !== 'ops.spinbot@gmail.com' ? `
                <button type="button" onclick="handleRemoveAllowedEmail('${em}')" class="btn btn-secondary btn-sm" style="color: #c5221f; border-color: #f8c4b8; background: #fff;">
                  <i class="ti ti-trash"></i> Revoke
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <form onsubmit="event.preventDefault(); showToast('System preferences saved successfully!', 'success');">
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" style="font-weight: 700;">Brand Title</label>
          <input type="text" class="form-control" value="SpinBot Warranty Registration"/>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Support Email</label>
            <input type="email" class="form-control" value="support@spinbot.co.in"/>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Default Warranty Period</label>
            <select class="form-select">
              <option value="12 Months" selected>12 Months Standard</option>
              <option value="6 Months">6 Months</option>
              <option value="24 Months">24 Months Extended</option>
            </select>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <div style="font-weight: 700; font-size: 13.5px; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <i class="ti ti-cloud-upload" style="color: #2563eb;"></i> Cloudflare R2 Storage Binding
          </div>
          <div class="form-group" style="margin-bottom: 10px;">
            <label class="form-label">Worker Endpoint URL</label>
            <input type="text" class="form-control" value="https://spinbot-upload.product-register.workers.dev" readonly style="background: #fff; font-family: monospace; font-size: 12px;"/>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">R2 Bucket Name</label>
              <input type="text" class="form-control" value="product-regstration" readonly style="background: #fff; font-family: monospace; font-size: 12px;"/>
            </div>
            <div class="form-group">
              <label class="form-label">Account ID</label>
              <input type="text" class="form-control" value="f93d598c460f017ff96b893e15c72df8" readonly style="background: #fff; font-family: monospace; font-size: 12px;"/>
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary">
          <i class="ti ti-check"></i> Save System Configuration
        </button>
      </form>

      <!-- TERMS & CONDITIONS EDITOR CARD -->
      <div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:22px; margin-top:24px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="font-size:15px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:8px;">
              <i class="ti ti-file-text" style="color:#76D300;font-size:20px;"></i> Terms &amp; Conditions
            </h4>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">Edit the T&amp;C shown to customers when they click the link in the registration form. Supports <strong>**bold**</strong> markdown.</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" onclick="previewTnC()" class="btn btn-ghost btn-sm" style="border:1px solid #e2e8f0;">
              <i class="ti ti-eye"></i> Preview
            </button>
            <button type="button" onclick="saveTnCFromAdmin()" class="btn btn-primary btn-sm">
              <i class="ti ti-device-floppy"></i> Save T&amp;C
            </button>
          </div>
        </div>

        <div id="tncPreviewBox" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:14px; font-size:13px; line-height:1.8; color:#374151; max-height:240px; overflow-y:auto;"></div>

        <textarea id="tncEditorArea" rows="14" class="form-control" style="font-family:monospace; font-size:12.5px; line-height:1.7; resize:vertical;" placeholder="Write your Terms & Conditions here...">Loading...</textarea>
        <div style="font-size:11px;color:#94a3b8;margin-top:8px;">💡 Use **text** for bold. Numbered lists (1. 2. 3.) render automatically in the customer popup.</div>
      </div>
    </div>
  `;

  // Load existing T&C into textarea
  getTermsAndConditions().then(text => {
    const ta = document.getElementById('tncEditorArea');
    if (ta) ta.value = text;
  });
}

window.handleAddMarketplace = async () => {
  const input = document.getElementById('newMktInput');
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    showToast('Please enter a marketplace name', 'warning');
    return;
  }
  await addMarketplace(name);
  showToast(`Marketplace "${name}" added to Step 3 form!`, 'success');
  renderSettingsView();
};

window.saveTnCFromAdmin = async () => {
  const ta = document.getElementById('tncEditorArea');
  if (!ta) return;
  const content = ta.value.trim();
  if (!content) { showToast('Terms & Conditions cannot be empty', 'warning'); return; }
  const btn = document.querySelector('[onclick="saveTnCFromAdmin()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Saving...'; }
  await saveTermsAndConditions(content);
  showToast('Terms & Conditions saved successfully! ✓ Customer form updated.', 'success');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Save T&C'; }
};

window.previewTnC = () => {
  const ta = document.getElementById('tncEditorArea');
  const preview = document.getElementById('tncPreviewBox');
  if (!ta || !preview) return;
  const text = ta.value;
  const rendered = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\d+\..+)$/gm, '<div style="margin-bottom:8px;">$1</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  preview.innerHTML = rendered;
  preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
};

window.handleRemoveMarketplace = async (name) => {
  await deleteMarketplace(name);
  showToast(`Marketplace "${name}" removed!`, 'info');
  renderSettingsView();
};

// -------------------------------------------------------------
// 10. MARKETPLACES VIEW (Dedicated Full-Page Section)
// -------------------------------------------------------------
async function renderMarketplacesView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  const mkts = (await getMarketplaces()) || [];

  container.innerHTML = `
    <div style="max-width: 820px; margin: 0 auto;">

      <!-- Header Card -->
      <div class="card-table-wrapper" style="padding: 28px 32px; margin-bottom: 24px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
          <div>
            <h2 style="font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 6px; display: flex; align-items: center; gap: 10px;">
              <span style="width: 40px; height: 40px; border-radius: 12px; background: rgba(118,211,0,0.15); display: inline-flex; align-items: center; justify-content: center;">
                <i class="ti ti-shopping-cart" style="color: #76D300; font-size: 22px;"></i>
              </span>
              Marketplace Management
            </h2>
            <p style="font-size: 13px; color: #64748b; max-width: 480px; line-height: 1.6;">
              Manage the list of purchase platforms shown to customers in the <strong>Step 3 Registration Form</strong> dropdown. Add new marketplaces or remove existing ones instantly — changes sync to the customer form in real time.
            </p>
          </div>
          <div style="background: rgba(118,211,0,0.08); border: 1px solid rgba(118,211,0,0.3); border-radius: 12px; padding: 14px 18px; text-align: center; min-width: 110px;">
            <div style="font-size: 28px; font-weight: 900; color: #529400; line-height: 1;">${mkts.length}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Platforms</div>
          </div>
        </div>
      </div>

      <!-- Add Marketplace Card -->
      <div class="card-table-wrapper" style="padding: 24px 32px; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <i class="ti ti-plus-circle" style="color: #76D300; font-size: 18px;"></i> Add New Marketplace
        </div>
        <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px;">
            <label class="form-label" style="font-weight: 700; margin-bottom: 6px;">Platform Name</label>
            <input type="text" id="newMktInput" class="form-control"
              placeholder="e.g. Meesho, Tata CLiQ, Reliance Digital, Croma..."
              style="height: 44px; font-size: 14px;"
              onkeydown="if(event.key==='Enter') handleAddMarketplace()"/>
          </div>
          <button type="button" class="btn btn-primary" style="height: 44px; padding: 0 24px; font-size: 14px;" onclick="handleAddMarketplace()">
            <i class="ti ti-plus"></i> Add Platform
          </button>
        </div>
        <div style="font-size: 11.5px; color: #94a3b8; margin-top: 10px;">
          <i class="ti ti-info-circle" style="font-size: 13px;"></i> Press <strong>Enter</strong> or click "Add Platform" — it will immediately appear in the customer registration form.
        </div>
      </div>

      <!-- Active Marketplaces List -->
      <div class="card-table-wrapper" style="padding: 24px 32px;">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
          <i class="ti ti-list" style="color: #76D300; font-size: 18px;"></i> Active Purchase Platforms
          <span style="margin-left: auto; font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 3px 10px; border-radius: 20px;">${mkts.length} total</span>
        </div>

        ${mkts.length === 0 ? `
          <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
            <i class="ti ti-shopping-cart-off" style="font-size: 40px; margin-bottom: 12px; display: block;"></i>
            <div style="font-size: 14px; font-weight: 600;">No marketplaces added yet</div>
            <div style="font-size: 12px; margin-top: 4px;">Use the form above to add your first platform</div>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${mkts.map((m, i) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; transition: all 0.15s ease;" onmouseover="this.style.borderColor='#76D300'; this.style.background='rgba(118,211,0,0.04)'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(118,211,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; color: #529400; flex-shrink: 0;">
                    ${i + 1}
                  </div>
                  <div>
                    <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${m}</div>
                    <div style="font-size: 11.5px; color: #94a3b8; margin-top: 1px;">Visible in Step 3 purchase platform dropdown</div>
                  </div>
                </div>
                <button type="button" onclick="handleRemoveMktView('${m}')" title="Remove marketplace"
                  style="display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; border: 1px solid #fecaca; background: #fff; color: #ef4444; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; font-family: inherit;"
                  onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'">
                  <i class="ti ti-trash" style="font-size: 14px;"></i> Remove
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}
window.renderMarketplacesView = renderMarketplacesView;

// Marketplace handlers that refresh the Marketplaces view (not Settings)
window.handleAddMarketplace = async () => {
  const input = document.getElementById('newMktInput');
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    showToast('Please enter a marketplace name', 'warning');
    return;
  }
  await addMarketplace(name);
  showToast(`"${name}" added to customer registration form!`, 'success');
  if (currentView === 'marketplaces') await renderMarketplacesView();
  else await renderSettingsView();
};

window.handleRemoveMktView = async (name) => {
  await deleteMarketplace(name);
  showToast(`"${name}" removed from registration form`, 'info');
  await renderMarketplacesView();
};
