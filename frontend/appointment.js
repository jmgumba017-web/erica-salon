// ============================================
// ERICA SALON — Appointment Booking Logic
// ============================================

console.log('📅 appointment.js loaded');

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? window.location.origin
  : 'https://erica-salon.onrender.com';

// ============================================
// HELPER: Show message
// ============================================
function showMessage(message, type = 'info') {
  const existing = document.querySelector('.auth-message');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = `auth-message auth-${type}`;
  div.textContent = message;
  div.style.cssText = `
    padding: 12px 16px;
    border-radius: 8px;
    margin: 15px 0;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    animation: slideDown 0.3s ease;
    ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
    ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
    ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
  `;

  const form = document.querySelector('.login-form');
  if (form && form.parentNode) {
    form.parentNode.insertBefore(div, form);
  } else {
    document.body.insertBefore(div, document.body.firstChild);
  }
  setTimeout(() => div.remove(), 5000);
}

// ============================================
// STEP 1: LOAD SERVICES FROM API
// ============================================
async function loadServices() {
  const serviceSelect = document.getElementById('service');
  if (!serviceSelect) return;

  try {
    const res = await fetch(`${API_URL}/api/services`);
    const data = await res.json();
    const services = data.services || data;

    console.log('📥 Services loaded:', services.length);

    const grouped = {};
    services.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });

    let html = '<option value="">Choose a service...</option>';
    const categoryIcons = {
      'Hair': '💇', 'Nails': '💅', 'Skin': '✨',
      'Body': '💆', 'Makeup': '💄', 'Lashes & Brows': '👁️'
    };

    for (const [category, list] of Object.entries(grouped)) {
      html += `<optgroup label="${categoryIcons[category] || '📌'} ${category}">`;
      list.forEach(s => {
        html += `<option value="${s._id}">${s.serviceName} - ₱${s.price} (${s.duration} mins)</option>`;
      });
      html += `</optgroup>`;
    }

    serviceSelect.innerHTML = html;

  } catch (err) {
    console.error('❌ Load services error:', err);
    serviceSelect.innerHTML = '<option value="">Error loading services</option>';
  }
}

// ============================================
// STEP 2: LOAD STAFF FROM API
// ============================================
async function loadStaff() {
  const staffGrid = document.querySelector('.staff-grid');
  if (!staffGrid) return;

  try {
    const res = await fetch(`${API_URL}/api/staff`);
    const data = await res.json();
    const staffList = data.staff || data;

    console.log('📥 Staff loaded:', staffList.length);

    let html = `
      <label class="staff-card staff-any">
        <input type="radio" name="staff" value="" checked>
        <div class="staff-photo staff-photo-any">
          <i class="fa-solid fa-users"></i>
        </div>
        <span class="staff-name">
          Any
          <span class="staff-role">Available</span>
        </span>
      </label>
    `;

    html += staffList.map((s) => `
      <label class="staff-card">
        <input type="radio" name="staff" value="${s._id}" data-name="${s.name}">
        <img src="${s.photo || 'image/erica.jpg'}" 
             alt="${s.name}" 
             class="staff-photo"
             onerror="this.onerror=null; this.src='image/erica.jpg';">
        <span class="staff-name">
          ${s.name.split(' ')[0]}
          <span class="staff-role">${s.specialization?.[0] || 'Staff'}</span>
        </span>
      </label>
    `).join('');

    staffGrid.innerHTML = html;

    document.querySelectorAll(".staff-card input").forEach(card => {
      card.addEventListener("change", () => {
        const staffName = card.value ? (card.dataset.name || 'Selected') : 'Any Available';
        console.log("Selected staff:", staffName);
        const sidebarStaff = document.getElementById('sidebarStaff');
        if (sidebarStaff) sidebarStaff.textContent = staffName;
      });
    });

    const sidebarStaff = document.getElementById('sidebarStaff');
    if (sidebarStaff) sidebarStaff.textContent = 'Any Available';

  } catch (err) {
    console.error('❌ Load staff error:', err);
    staffGrid.innerHTML = '<p style="color:#999;">Error loading staff</p>';
  }
}

// ============================================
// STEP 2.5: LOAD DAY STATUS
// ============================================
async function loadDayStatus(date) {
  if (!date) return;

  try {
    const res = await fetch(`${API_URL}/api/appointments/day-status/${date}`);
    const data = await res.json();

    console.log('📥 Day status:', data);

    if (!data.success) return;

    const dateBadge = document.getElementById('dateBadge');
    const form = document.getElementById('appointmentForm');

    // ✅ Guard: kung walang dateBadge
    if (!dateBadge) {
      console.warn('⚠️ #dateBadge not found — skipping badge insertion');
      return;
    }

    // Alisin ang lumang badge
    const oldBadge = document.getElementById('dayStatusBadge');
    if (oldBadge) oldBadge.remove();

    // Gumawa ng bagong badge
    const container = document.createElement('div');
    container.id = 'dayStatusBadge';
    container.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 20px;
      width: 100%;
      justify-content: center;
    `;

    if (data.isFull) {
      container.style.background = '#f8d7da';
      container.style.color = '#721c24';
      container.innerHTML = `🚫 <strong>FULLY BOOKED</strong> — ${data.booked}/${data.maxCapacity} slots taken`;
    } else {
      container.style.background = '#d4edda';
      container.style.color = '#155724';
      container.innerHTML = `✅ <strong>${data.available}</strong> slot(s) remaining — ${data.booked}/${data.maxCapacity} booked`;
    }

    dateBadge.parentNode.insertBefore(container, dateBadge.nextSibling);

    // Enable/Disable submit button
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        if (data.isFull) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Fully Booked';
          submitBtn.style.opacity = '0.6';
          submitBtn.style.cursor = 'not-allowed';
          showMessage('❌ This date is fully booked. Please choose another date.', 'error');
        } else {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Book Appointment';
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        }
      }
    }

  } catch (err) {
    console.error('❌ Load day status error:', err);
  }
}

// ============================================
// STEP 3: SUBMIT BOOKING
// ============================================
const appointmentForm = document.getElementById('appointmentForm');

if (appointmentForm) {
  console.log('📅 Appointment form detected');

  appointmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first');
      window.location.href = 'login.html';
      return;
    }

    const appointmentDate = document.getElementById('appointmentDate').value;
    const appointmentTime = document.querySelector('input[name="time"]:checked')?.value;
    const serviceId = document.getElementById('service').value;
    let staffId = document.querySelector('input[name="staff"]:checked')?.value;
    const notes = document.getElementById('notes')?.value || '';

    // ✅ Staff is OPTIONAL — auto-assign if empty
    if (!staffId) {
      console.log('📌 No staff selected — auto-assigning available staff');

      const firstStaffRadio = document.querySelector('input[name="staff"]:not([value=""])');

      if (firstStaffRadio && firstStaffRadio.value) {
        staffId = firstStaffRadio.value;
        console.log('✅ Auto-assigned to:', staffId);
      } else {
        return showMessage('❌ No staff available at the moment. Please try again later.', 'error');
      }
    }

    // Validation
    if (!appointmentDate) {
      return showMessage('❌ Please select a date first (go to calendar)', 'error');
    }
    if (!appointmentTime) {
      return showMessage('❌ Please select a preferred time', 'error');
    }
    if (!serviceId) {
      return showMessage('❌ Please select a service', 'error');
    }
    if (!staffId) {
      return showMessage('❌ Please select a staff', 'error');
    }

    const bookingData = {
      appointmentDate,
      appointmentTime,
      services: [{ serviceId, staffId }],
      notes
    };

    console.log('📤 Booking data:', bookingData);

    const submitBtn = appointmentForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';

    try {
      const res = await fetch(`${API_URL}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingData)
      });

      const data = await res.json();
      console.log('📥 Booking response:', data);

      if (data.success) {
        // ✅ Check kung kailangan ng down payment (first-time customer)
        if (data.requireDownPayment) {
          showMessage('✅ ' + data.message, 'success');
          setTimeout(() => {
            window.location.href = `pay.html?id=${data.appointment._id}&type=downpayment`;
          }, 2000);
        } else {
          showMessage('✅ ' + data.message, 'success');
          setTimeout(() => {
            window.location.href = 'history.html';
          }, 1500);
        }
      } else {
        showMessage('❌ ' + data.message, 'error');
      }
    } catch (err) {
      console.error('❌ Booking error:', err);
      showMessage('⚠️ Network error. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// ============================================
// INITIALIZE
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  loadServices();
  loadStaff();

  const dateParam = new URLSearchParams(window.location.search).get('date');
  if (dateParam) {
    loadDayStatus(dateParam);
  }
});