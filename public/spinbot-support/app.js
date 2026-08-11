/* ==========================================================================
   SpinBot Support Hub — Interactive Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Update footer year dynamically
  const yearEl = document.getElementById('yearText');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Bind main search input listener
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
 * Redirects directly to Shiprocket tracking page
 */
window.handleQuickTrack = function(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('quickAwbInput');
  if (!input) return;
  const val = input.value.trim();
  
  if (val) {
    // Shiprocket tracking URL with order ID / AWB
    const trackingUrl = `https://spinbot.shiprocket.co/tracking/${encodeURIComponent(val)}`;
    window.open(trackingUrl, '_blank');
  } else {
    window.open('https://spinbot.shiprocket.co/tracking/', '_blank');
  }
};

/**
 * Toggle FAQ Accordion Items
 */
window.toggleFaq = function(element) {
  const item = element.parentElement;
  if (!item) return;

  const isActive = item.classList.contains('active');
  
  // Close all open FAQs
  document.querySelectorAll('.faq-item').forEach(el => {
    el.classList.remove('active');
  });

  // Toggle clicked FAQ
  if (!isActive) {
    item.classList.add('active');
  }
};

/**
 * Filter FAQs and Cards based on Search Input
 */
window.filterSupportContent = function(query) {
  const q = (query || '').toLowerCase().trim();

  // Filter FAQ items
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });

  // Filter Core Service Cards
  const cards = document.querySelectorAll('.feature-card');
  cards.forEach(card => {
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
  const val = input.value.trim();

  if (val.toLowerCase().includes('track') || val.toLowerCase().includes('ship') || val.toLowerCase().includes('order')) {
    document.getElementById('cardTracking')?.scrollIntoView({ behavior: 'smooth' });
  } else if (val.toLowerCase().includes('test') || val.toLowerCase().includes('gear') || val.toLowerCase().includes('trigger')) {
    document.getElementById('cardTester')?.scrollIntoView({ behavior: 'smooth' });
  } else if (val.toLowerCase().includes('reg') || val.toLowerCase().includes('warrant') || val.toLowerCase().includes('claim')) {
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
    titleEl.innerHTML = `<i class="ti ti-layout-window"></i> ${title || 'SpinBot Interactive Viewer'}`;
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

// Close modal on escape key press
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModalViewer();
  }
});
