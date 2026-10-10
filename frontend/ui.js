// ============================================
// ERICA SALON — Global UI Library
// Toast, Modal, Loading, Utilities
// ============================================

console.log('🎨 ui.js loaded');

// ============================================
// 1. TOAST NOTIFICATIONS
// ============================================
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    toast.innerHTML = `
      <div class="toast-icon">
        <i class="fa-solid ${icons[type] || icons.info}"></i>
      </div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg, d) { this.show(msg, 'success', d); },
  error(msg, d) { this.show(msg, 'error', d); },
  warning(msg, d) { this.show(msg, 'warning', d); },
  info(msg, d) { this.show(msg, 'info', d); }
};

// ============================================
// 2. CONFIRM MODAL
// ============================================
const Confirm = {
  show(options) {
    return new Promise((resolve) => {
      const {
        title = 'Are you sure?',
        message = '',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'warning',
        requireReason = false,
        reasonPlaceholder = 'Enter reason...'
      } = options;

      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';

      const icons = {
        warning: 'fa-exclamation-triangle',
        danger: 'fa-trash',
        info: 'fa-info-circle',
        success: 'fa-check-circle'
      };

      overlay.innerHTML = `
        <div class="confirm-modal">
          <div class="confirm-icon confirm-icon-${type}">
            <i class="fa-solid ${icons[type] || icons.warning}"></i>
          </div>
          <h3>${title}</h3>
          ${message ? `<p>${message}</p>` : ''}
          ${requireReason ? `
            <textarea class="confirm-reason" placeholder="${reasonPlaceholder}"></textarea>
          ` : ''}
          <div class="confirm-actions">
            <button class="btn-cancel">${cancelText}</button>
            <button class="btn-confirm btn-${type}">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        overlay.classList.add('show');
      });

      const close = (result) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
        resolve(result);
      };

      overlay.querySelector('.btn-cancel').addEventListener('click', () => close(false));
      overlay.querySelector('.btn-confirm').addEventListener('click', () => {
        const reasonInput = overlay.querySelector('.confirm-reason');
        if (requireReason) {
          const reason = reasonInput?.value?.trim();
          if (!reason) {
            reasonInput.style.borderColor = '#dc3545';
            Toast.warning('Please enter a reason');
            return;
          }
          close({ confirmed: true, reason });
        } else {
          close(true);
        }
      });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });
    });
  }
};

// ============================================
// 3. SKELETON LOADERS
// ============================================
const Skeleton = {
  card() {
    return `
      <div class="skeleton-card">
        <div class="skeleton-line skeleton-line-lg"></div>
        <div class="skeleton-line skeleton-line-md"></div>
        <div class="skeleton-line skeleton-line-sm"></div>
      </div>
    `;
  },

  list(count = 3) {
    return Array(count).fill(this.card()).join('');
  },

  table(rows = 5) {
    return `
      <div class="skeleton-table">
        ${Array(rows).fill(`
          <div class="skeleton-row">
            <div class="skeleton-circle"></div>
            <div class="skeleton-line skeleton-line-md"></div>
            <div class="skeleton-line skeleton-line-sm"></div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// ============================================
// 4. LOADING BUTTON
// ============================================
function setLoading(button, isLoading, loadingText = 'Loading...') {
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}

// ============================================
// 5. PAGE TRANSITIONS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-loaded');
});

// ============================================
// 6. SMOOTH SCROLL
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ============================================
// 7. LOAD USER INFO IN DROPDOWN
// ============================================
function loadUserInfo() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const nameEl = document.getElementById('dropdownName');
  const emailEl = document.getElementById('dropdownEmail');

  if (nameEl && user.name) nameEl.textContent = user.name;
  if (emailEl && user.email) emailEl.textContent = user.email;
}

// Auto-load when DOM ready
document.addEventListener('DOMContentLoaded', loadUserInfo);

// ============================================
// 8. FORMAT UTILITIES
// ============================================
const Format = {
  currency(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  date(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  time(timeStr) {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  },

  relativeDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
    return this.date(dateStr);
  }
};

// ============================================
// 9. EXPORT TO WINDOW
// ============================================
window.Toast = Toast;
window.Confirm = Confirm;
window.Skeleton = Skeleton;
window.setLoading = setLoading;
window.Format = Format;

console.log('✅ UI library ready');