// ============================================
// ERICA SALON — Appointment Booking Logic
// ============================================

console.log('📅 appointment.js loaded');

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? window.location.origin
  : 'https://erica-salon.onrender.com';

// ============================================
// LOAD BOOKED TIME SLOTS
// ============================================
async function loadBookedTimes() {
    const dateInput = document.getElementById('appointmentDate');
    if (!dateInput) return;

    const date = dateInput.value;
    if (!date) return;

    try {
        const res = await fetch(`${API_URL}/api/appointments/booked-times/${date}`);
        const data = await res.json();

        console.log('📥 Booked times:', data);

        if (data.success) {
            document.querySelectorAll('.time-slot').forEach(slot => {
                slot.classList.remove('booked');
                slot.style.opacity = '';
                slot.style.cursor = '';
                
                const radio = slot.querySelector('input[type="radio"]');
                if (radio) {
                    radio.disabled = false;
                }
            });

            data.bookedTimes.forEach(bookedTime => {
                const slot = document.querySelector(`.time-slot input[value="${bookedTime}"]`)?.closest('.time-slot');
                
                if (slot) {
                    slot.classList.add('booked');
                    slot.style.opacity = '0.5';
                    slot.style.cursor = 'not-allowed';
                    
                    const radio = slot.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.disabled = true;
                        radio.checked = false;
                    }
                }
            });
        }
    } catch (err) {
        console.error('❌ Load booked times error:', err);
    }
}

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
// STEP 1: LOAD SERVICES
// ============================================
const MAX_SERVICES = 3;
let selectedServices = [];
let allServices = [];

async function loadServices() {
  const container = document.getElementById('servicesContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_URL}/api/services`);
    const data = await res.json();
    const services = data.services || data;
    allServices = services;

    console.log('📥 Services loaded:', services.length);

    const grouped = {};
    services.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });

    const categoryIcons = {
      'Hair': '💇', 'Nails': '💅', 'Skin': '✨',
      'Body': '💆', 'Makeup': '💄', 'Lashes & Brows': '👁️'
    };

    let html = '';
    for (const [category, list] of Object.entries(grouped)) {
      html += `<div class="service-category">`;
      html += `<div class="service-category-label">${categoryIcons[category] || '📌'} ${category}</div>`;

      list.forEach(s => {
        html += `
          <label class="service-item" data-id="${s._id}" data-name="${s.serviceName}" data-price="${s.price}" data-duration="${s.duration}">
            <input type="checkbox" class="service-checkbox" value="${s._id}">
            <div class="service-info">
              <span class="service-name">${s.serviceName}</span>
              <span class="service-meta">⏱ ${s.duration} mins</span>
            </div>
            <span class="service-price">₱${s.price}</span>
          </label>
        `;
      });

      html += `</div>`;
    }

    container.innerHTML = html;

    document.querySelectorAll('.service-item').forEach(item => {
      const checkbox = item.querySelector('.service-checkbox');
      checkbox.addEventListener('change', () => {
        handleServiceToggle(item, checkbox);
      });
    });

    renderSelectedChips();

  } catch (err) {
    console.error('❌ Load services error:', err);
    container.innerHTML = '<p style="color:#c00; padding: 12px;">Error loading services</p>';
  }
}

// ============================================
// HANDLE SERVICE TOGGLE
// ============================================
function handleServiceToggle(item, checkbox) {
  const id = item.dataset.id;
  const name = item.dataset.name;
  const price = parseFloat(item.dataset.price);
  const duration = parseInt(item.dataset.duration);

  if (checkbox.checked) {
    if (selectedServices.length >= MAX_SERVICES) {
      checkbox.checked = false;
      showServiceLimitWarning();
      return;
    }
    selectedServices.push({ _id: id, serviceName: name, price, duration });
    item.classList.add('selected');
  } else {
    selectedServices = selectedServices.filter(s => s._id !== id);
    item.classList.remove('selected');
  }

  updateServicesUI();
}

// ============================================
// UPDATE UI
// ============================================
function updateServicesUI() {
  const counter = document.getElementById('serviceCount');
  if (counter) counter.textContent = `${selectedServices.length}/${MAX_SERVICES} selected`;

  document.querySelectorAll('.service-item').forEach(item => {
    const isSelected = selectedServices.some(s => s._id === item.dataset.id);
    if (!isSelected && selectedServices.length >= MAX_SERVICES) {
      item.classList.add('disabled');
    } else {
      item.classList.remove('disabled');
    }
  });

  renderSelectedChips();
  updateSummaryServices();
}

// ============================================
// RENDER SELECTED CHIPS
// ============================================
function renderSelectedChips() {
  const container = document.getElementById('selectedServices');
  if (!container) return;

  if (selectedServices.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedServices.map(s => `
    <span class="service-chip" data-id="${s._id}">
      ${s.serviceName}
      <button type="button" class="chip-remove" aria-label="Remove">✕</button>
    </span>
  `).join('');

  container.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const chip = btn.closest('.service-chip');
      const id = chip.dataset.id;
      removeServiceById(id);
    });
  });
}

// ============================================
// REMOVE SERVICE
// ============================================
function removeServiceById(id) {
  selectedServices = selectedServices.filter(s => s._id !== id);

  const item = document.querySelector(`.service-item[data-id="${id}"]`);
  if (item) {
    item.classList.remove('selected');
    const cb = item.querySelector('.service-checkbox');
    if (cb) cb.checked = false;
  }

  updateServicesUI();
}

// ============================================
// SHOW LIMIT WARNING
// ============================================
function showServiceLimitWarning() {
  const existing = document.querySelector('.service-limit-warning');
  if (existing) existing.remove();

  const warning = document.createElement('div');
  warning.className = 'service-limit-warning';
  warning.innerHTML = `⚠️ Maximum <strong>${MAX_SERVICES} services</strong> lang per booking. Alisin muna ang isa para makapagdagdag.`;

  const container = document.getElementById('servicesContainer');
  if (container && container.parentNode) {
    container.parentNode.insertBefore(warning, container.nextSibling);
  }

  setTimeout(() => warning.remove(), 3500);
}

// ============================================
// UPDATE SIDEBAR SUMMARY
// ============================================
function updateSummaryServices() {
  const sidebarService = document.getElementById('sidebarService');
  if (!sidebarService) return;

  if (selectedServices.length === 0) {
    sidebarService.textContent = '—';
    return;
  }

  if (selectedServices.length <= 2) {
    sidebarService.textContent = selectedServices.map(s => s.serviceName).join(', ');
  } else {
    sidebarService.textContent = `${selectedServices[0].serviceName} +${selectedServices.length - 1} more`;
  }
}

// ============================================
// LOAD STAFF
// ============================================
async function loadStaff() {
  const staffGrid = document.querySelector('.staff-grid');
  if (!staffGrid) return;

  try {
    const res = await fetch(`${API_URL}/api/staff`);
    const data = await res.json();
    const staffList = data.staff || [];

    console.log('📥 Staff loaded:', staffList.length);

    let html = `
      <label class="staff-card staff-any">
        <input type="radio" name="staff" value="" checked>
        <div class="staff-photo-any">
          <i class="fa-solid fa-user-group"></i>
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
          ${s.name}
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
// LOAD DAY STATUS
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

    if (!dateBadge) return;

    const oldBadge = document.getElementById('dayStatusBadge');
    if (oldBadge) oldBadge.remove();

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
// SUBMIT BOOKING
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
    let staffId = document.querySelector('input[name="staff"]:checked')?.value;
    const notes = document.getElementById('notes')?.value || '';

    if (!staffId) {
      const firstStaffRadio = document.querySelector('input[name="staff"]:not([value=""])');
      if (firstStaffRadio && firstStaffRadio.value) {
        staffId = firstStaffRadio.value;
      } else {
        return showMessage('❌ No staff available at the moment. Please try again later.', 'error');
      }
    }

    if (!appointmentDate) return showMessage('❌ Please select a date first', 'error');
    if (!appointmentTime) return showMessage('❌ Please select a preferred time', 'error');
    if (selectedServices.length === 0) return showMessage('❌ Please select at least 1 service', 'error');
    if (selectedServices.length > MAX_SERVICES) return showMessage(`❌ Maximum ${MAX_SERVICES} services lang per booking`, 'error');
    if (!staffId) return showMessage('❌ Please select a staff', 'error');

    const bookingData = {
      appointmentDate,
      appointmentTime,
      services: selectedServices.map(s => ({
        serviceId: s._id,
        staffId: staffId
      })),
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
window.addEventListener('DOMContentLoaded', async () => {
  await loadServices();
  await loadStaff();

  const dateParam = new URLSearchParams(window.location.search).get('date');
  if (dateParam) {
    loadDayStatus(dateParam);
    loadBookedTimes();
  }
});