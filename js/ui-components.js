// Reusable UI Components & Utilities (With CSV and Printable PDF Exporters)

// Toast Notification Manager
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'ti-circle-check',
    error: 'ti-alert-circle',
    warning: 'ti-alert-triangle',
    info: 'ti-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="ti ${icons[type] || icons.info} toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Modal Dialog System
export function showModal({ title, bodyHtml, confirmText = 'Confirm', confirmClass = 'btn-primary', cancelText = 'Cancel', onConfirm = null, maxWidth = '560px' }) {
  let overlay = document.getElementById('globalModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'globalModalOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: ${maxWidth};">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modalCloseBtn"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${(cancelText || confirmText) ? `
      <div class="modal-footer">
        ${cancelText ? `<button class="btn btn-secondary" id="modalCancelBtn">${cancelText}</button>` : ''}
        ${confirmText ? `<button class="btn ${confirmClass}" id="modalConfirmBtn">${confirmText}</button>` : ''}
      </div>` : ''}
    </div>
  `;

  overlay.classList.add('active');

  const close = () => {
    overlay.classList.remove('active');
  };

  overlay.querySelector('#modalCloseBtn')?.addEventListener('click', close);
  overlay.querySelector('#modalCancelBtn')?.addEventListener('click', close);
  
  const confirmBtn = overlay.querySelector('#modalConfirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (onConfirm) {
        const result = await onConfirm();
        if (result !== false) close();
      } else {
        close();
      }
    });
  }
}

// Render Empty State
export function renderEmptyState(container, title = 'No data found', desc = 'There are no records matching your criteria.', icon = 'ti-folder-off') {
  container.innerHTML = `
    <div class="empty-state">
      <i class="ti ${icon} empty-state-icon"></i>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-desc">${desc}</div>
    </div>
  `;
}

// Render Pagination Component
export function renderPaginationContainer(container, totalItems, pageSize, currentPage, onPageChange) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  let pagesHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      pagesHtml += `<span style="padding: 0 4px; color: var(--text-light);">...</span>`;
    }
  }

  container.innerHTML = `
    <div>Showing <strong>${startItem}-${endItem}</strong> of <strong>${totalItems}</strong> items</div>
    <div class="pagination">
      <button class="page-btn" id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}><i class="ti ti-chevron-left"></i></button>
      ${pagesHtml}
      <button class="page-btn" id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}><i class="ti ti-chevron-right"></i></button>
    </div>
  `;

  container.querySelector('#prevPageBtn')?.addEventListener('click', () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  });

  container.querySelector('#nextPageBtn')?.addEventListener('click', () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  });

  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = parseInt(e.currentTarget.getAttribute('data-page'));
      onPageChange(p);
    });
  });
}

// CSV Export Utility
export function exportToCSV(filename, headers, rows) {
  const csvRows = [headers.join(',')];
  
  rows.forEach(row => {
    const values = row.map(val => {
      const escaped = ('' + (val ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${rows.length} rows to CSV`, 'success');
}

// PDF Export Utility (Printable HTML Document Generator)
export function exportToPDF(reportTitle, headers, rows, filename = 'export.pdf') {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Please allow popups to export PDF', 'warning');
    return;
  }

  const tableHeaders = headers.map(h => `<th style="background:#0f172a; color:#fff; padding:10px; font-size:11px; text-transform:uppercase;">${h}</th>`).join('');
  const tableBody = rows.map(r => `
    <tr>
      ${r.map(c => `<td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:12px; color:#1e293b;">${c ?? '-'}</td>`).join('')}
    </tr>
  `).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportTitle}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
        .title { font-size: 20px; font-weight: 800; color: #0f172a; }
        .date { font-size: 12px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">SpinBot — ${reportTitle}</div>
          <div class="date">Generated on ${new Date().toLocaleString()}</div>
        </div>
      </div>
      <table>
        <thead><tr>${tableHeaders}</tr></thead>
        <tbody>${tableBody}</tbody>
      </table>
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `);
  win.document.close();
  showToast('Generating PDF Document...', 'info');
}

// Status Tag Formatter
export function renderStatusBadge(status = 'Pending') {
  const s = (status || 'Pending').toLowerCase();
  let badgeClass = 'badge-pending';
  let label = status;

  if (s === 'active' || s === 'approved' || s === 'resolved') {
    badgeClass = 'badge-active';
  } else if (s === 'expired' || s === 'rejected' || s === 'closed') {
    badgeClass = 'badge-expired';
  } else if (s === 'open' || s === 'in progress') {
    badgeClass = 'badge-open';
  }

  return `<span class="badge ${badgeClass}"><span class="badge-dot"></span>${label}</span>`;
}

// Date Formatter
export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Input Restrictions Helper: Alphabets for Names, Exactly 10 Digits for Phone Numbers, No Future Purchase Dates
export function setupInputRestrictions() {
  if (typeof document === 'undefined') return;

  // Set max attribute on purchase date fields to today's date
  const setMaxPurchaseDate = () => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      const dateInputs = document.querySelectorAll('input[type="date"]');
      dateInputs.forEach(el => {
        const id = (el.id || '').toLowerCase();
        if (id.includes('purchasedate') || id.includes('purchase')) {
          el.setAttribute('max', todayStr);
        }
      });
    } catch(e){}
  };

  const handleInputRestriction = (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT') return;

    const id = (el.id || '').toLowerCase();
    const type = (el.type || '').toLowerCase();
    const nameAttr = (el.name || '').toLowerCase();

    // Purchase Date field: prevent future date selection
    if (type === 'date' && (id.includes('purchasedate') || id.includes('purchase'))) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      el.setAttribute('max', todayStr);

      if (el.value && el.value > todayStr) {
        el.value = todayStr;
      }
    }
    // Phone fields: digits only, max 10 chars
    else if (type === 'tel' || id.includes('phone') || id.includes('cphone') || id.includes('mobile') || nameAttr.includes('phone')) {
      if (!el.hasAttribute('maxlength') || el.getAttribute('maxlength') !== '10') {
        el.setAttribute('maxlength', '10');
      }
      const cleaned = el.value.replace(/[^0-9]/g, '').slice(0, 10);
      if (el.value !== cleaned) {
        el.value = cleaned;
      }
    }
    // Name fields: alphabets & spaces only
    else if (
      id === 'fullname' ||
      id === 'custnameinput' ||
      id === 'cname' ||
      (nameAttr.includes('name') && !id.includes('brand') && !id.includes('sku') && !id.includes('prod') && !id.includes('file') && !id.includes('login') && !id.includes('user') && !id.includes('search'))
    ) {
      const cleaned = el.value.replace(/[^a-zA-Z\s]/g, '');
      if (el.value !== cleaned) {
        el.value = cleaned;
      }
    }
  };

  setMaxPurchaseDate();
  document.removeEventListener('input', handleInputRestriction);
  document.addEventListener('input', handleInputRestriction);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInputRestrictions);
  } else {
    setupInputRestrictions();
  }
}

