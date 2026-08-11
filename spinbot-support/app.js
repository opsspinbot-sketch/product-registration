/* ==========================================================================
   SpinBot Support — Official Google Help Center Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('yearText');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const searchInput = document.getElementById('mainSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterSupportContent(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearchQuery();
    });
  }
});

/**
 * Handle Quick Track Form submission
 */
window.handleQuickTrack = function(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('quickAwbInput');
  if (!input) return;
  const val = input.value.trim();
  
  if (val) {
    const trackingUrl = `https://spinbot.shiprocket.co/tracking/${encodeURIComponent(val)}`;
    window.open(trackingUrl, '_blank');
  } else {
    window.open('https://spinbot.shiprocket.co/tracking/', '_blank');
  }
};

/**
 * Toggle FAQ Accordion Cards
 */
window.toggleFaq = function(element) {
  const card = element.parentElement;
  if (!card) return;

  const isActive = card.classList.contains('active');
  
  document.querySelectorAll('.faq-card').forEach(el => {
    el.classList.remove('active');
  });

  if (!isActive) {
    card.classList.add('active');
  }
};

/**
 * Filter Content based on Search Input
 */
window.filterSupportContent = function(query) {
  const q = (query || '').toLowerCase().trim();

  document.querySelectorAll('.faq-card').forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = (!q || text.includes(q)) ? 'block' : 'none';
  });

  document.querySelectorAll('.google-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    } else {
      card.style.opacity = '0.4';
      card.style.transform = 'scale(0.98)';
    }
  });
};

/**
 * Handle Search button click
 */
window.handleSearchQuery = function() {
  const input = document.getElementById('mainSearchInput');
  if (!input) return;
  const val = input.value.trim().toLowerCase();

  if (val.includes('track') || val.includes('ship') || val.includes('order')) {
    document.getElementById('cardTracking')?.scrollIntoView({ behavior: 'smooth' });
  } else if (val.includes('test') || val.includes('gear') || val.includes('trigger')) {
    document.getElementById('cardTester')?.scrollIntoView({ behavior: 'smooth' });
  } else if (val.includes('reg') || val.includes('warrant') || val.includes('claim')) {
    document.getElementById('cardRegistration')?.scrollIntoView({ behavior: 'smooth' });
  } else {
    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
  }
};

/**
 * Launch Interactive Modal Iframe Popup
 */
window.launchModalViewer = function(url, title) {
  const overlay = document.getElementById('appModalOverlay');
  const iframe = document.getElementById('modalIframe');
  const titleEl = document.getElementById('modalTitleText');

  if (!overlay || !iframe) return;

  if (titleEl) {
    titleEl.querySelector('span').textContent = title || 'SpinBot Interactive Tool';
  }

  iframe.src = url;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

/**
 * Close Interactive Modal Popup
 */
window.closeModalViewer = function() {
  const overlay = document.getElementById('appModalOverlay');
  const iframe = document.getElementById('modalIframe');

  if (overlay) overlay.classList.remove('active');
  if (iframe) iframe.src = 'about:blank';
  document.body.style.overflow = 'auto';
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModalViewer();
});
