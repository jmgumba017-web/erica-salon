// ============================================
// ERICA SALON — Admin Dashboard Logic
// ============================================

console.log('👑 dashboard.js loaded');

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? window.location.origin
  : 'https://erica-salon.onrender.com';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// Check auth
if (!token) {
  alert('Please login first');
  window.location.href = 'login.html';
}

if (user.role !== 'Admin') {
  alert('Access denied. Admin only.');
  window.location.href = 'homepage.html';
}

// Show admin name
document.getElementById('adminName').textContent = user.name || 'Admin';
document.getElementById('dropdownName').textContent = user.name || 'Admin';
document.getElementById('dropdownEmail').textContent = user.email || '';

// ============================================
// STATE
// ============================================
let currentFilter = { status: 'all', date: '', search: '' };
let searchTimer;
let allServices = [];
let allStaff = [];
let allServicesForStaff = [];
let currentScheduleStaffId = null;
let currentSchedules = [];
let currentBlocked = [];

// ============================================
// LOAD STATS
// ============================================
async function loadStats() {
  try {
    const res = await fetch(`${API_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      const s = data.stats;
      document.getElementById('statTotal').textContent = s.totalAppointments;
      document.getElementById('statPending').textContent = s.pendingAppointments;
      document.getElementById('statConfirmed').textContent = s.confirmedAppointments;
      document.getElementById('statToday').textContent = s.todayAppointments;
      document.getElementById('statRevenue').textContent = '₱' + s.totalRevenue.toLocaleString();
      document.getElementById('statBalance').textContent = '₱' + s.pendingBalance.toLocaleString();
    }
  } catch (err) {
    console.error('❌ Stats error:', err);
  }
}

// ============================================
// LOAD APPOINTMENTS
// ============================================
async function loadAppointments() {
  const list = document.getElementById('appointmentsList');
  if (!list) return;
  list.innerHTML = Skeleton.list(3);

  try {
    const params = new URLSearchParams();
    if (currentFilter.status && currentFilter.status !== 'all') {
      params.set('status', currentFilter.status);
    }
    if (currentFilter.date) params.set('date', currentFilter.date);
    if (currentFilter.search) params.set('search', currentFilter.search);

    const res = await fetch(`${API_URL}/api/admin/appointments?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    console.log('📥 Appointments:', data);

    if (data.success && data.appointments) {
      data.appointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (!data.success || data.appointments.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-calendar-xmark"></i>
          <h3>No appointments found</h3>
          <p>Try changing the filters</p>
        </div>
      `;
      return;
    }

    list.innerHTML = data.appointments.map(appt => renderCard(appt)).join('');

  } catch (err) {
    console.error('❌ Error:', err);
    list.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ============================================
// RENDER APPOINTMENT CARD
// ============================================
function renderCard(appt) {
  const servicesHTML = appt.services.map(s => `
    <li>💅 <strong>${s.serviceId?.serviceName || 'Service'}</strong> — 
      <span style="color:#999;">👤 ${s.staffId?.name || 'Staff'}</span> — ₱${s.price}
    </li>
  `).join('');

  const paid = appt.totalAmount - appt.remainingBalance;

  // ✅ ADMIN VIEW NG RECEIPT
  let receiptSection = '';
  if (appt.proofOfPayment) {
      receiptSection = `
        <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #333;"><i class="fa-solid fa-receipt"></i> Proof of Payment</h4>
            <a href="${appt.proofOfPayment}" target="_blank">
                <img src="${appt.proofOfPayment}" style="max-width: 200px; border-radius: 8px; border: 1px solid #ccc; cursor: pointer;">
            </a>
            <div style="margin-top: 10px;">
                <span style="font-size: 12px; font-weight: bold; color: ${appt.paymentStatus === 'Verified' ? '#28a745' : '#ffc107'};">
                    Status: ${appt.paymentStatus}
                </span>
            </div>
            ${appt.paymentStatus === 'Pending Verification' ? `
                <button onclick="verifyPayment('${appt._id}')" class="action-btn btn-complete" style="margin-top: 10px;">
                    <i class="fa-solid fa-check"></i> Verify Payment
                </button>
            ` : ''}
        </div>
      `;
  }

  let actions = '';

  if (appt.status === 'Pending') {
    actions = `
      <button class="action-btn btn-confirm" onclick="confirmAppt('${appt._id}')">
        <i class="fa-solid fa-check"></i> Confirm
      </button>
      <button class="action-btn btn-cancel" onclick="cancelAppt('${appt._id}')">
        <i class="fa-solid fa-xmark"></i> Cancel
      </button>
    `;
  } else if (appt.status === 'Confirmed') {
    actions = `
      <button class="action-btn btn-complete" onclick="completeAppt('${appt._id}')">
        <i class="fa-solid fa-check-double"></i> Complete
      </button>
      <button class="action-btn btn-cancel" onclick="cancelAppt('${appt._id}')">
        <i class="fa-solid fa-xmark"></i> Cancel
      </button>
    `;
  } else if (appt.status === 'In Progress') {
    actions = `
      <button class="action-btn btn-complete" onclick="completeAppt('${appt._id}')">
        <i class="fa-solid fa-check-double"></i> Complete
      </button>
    `;
  }

  return `
    <div class="appointment-card status-${appt.status.replace(' ', '')}">
      <div class="appt-header">
        <div>
          <div class="appt-customer">👤 ${appt.customerId?.name || 'Customer'}</div>
          <div class="appt-contact">📧 ${appt.customerId?.email || ''} • 📱 ${appt.customerId?.contactNumber || ''}</div>
        </div>
        <span class="appt-status status-${appt.status.replace(' ', '')}">${appt.status}</span>
      </div>

      <div class="appt-details">
        <div>📅 <strong>${appt.appointmentDate}</strong></div>
        <div>⏰ <strong>${appt.appointmentTime}</strong> — ${appt.endTime || '?'}</div>
        <div>💰 Total: <strong>₱${appt.totalAmount.toFixed(2)}</strong></div>
        <div>✅ Paid: <strong style="color:#28a745;">₱${paid.toFixed(2)}</strong></div>
        <div>⚠️ Balance: <strong style="color:${appt.remainingBalance > 0 ? '#dc3545' : '#28a745'};">₱${appt.remainingBalance.toFixed(2)}</strong></div>
      </div>

      <ul class="appt-services">
        ${servicesHTML}
      </ul>
      
      ${receiptSection}

      ${appt.notes ? `<div style="font-size:13px; color:#666; font-style:italic; margin-bottom:12px;">📝 "${appt.notes}"</div>` : ''}
      ${appt.cancelReason ? `<div style="font-size:13px; color:#dc3545; margin-bottom:12px;">❌ Cancelled: ${appt.cancelReason}</div>` : ''}

      <div class="appt-actions">
        ${actions}
      </div>
    </div>
  `;
}

// ============================================
// FILTERS
// ============================================
function filterStatus(status, btn) {
  currentFilter.status = status;
  document.querySelectorAll('.filter-btn[data-status]').forEach(b => {
    b.classList.remove('active');
    b.classList.add('inactive');
  });
  btn.classList.remove('inactive');
  btn.classList.add('active');
  loadAppointments();
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentFilter.search = document.getElementById('filterSearch').value.trim();
    loadAppointments();
  }, 400);
}

// ============================================
// ACTIONS — CONFIRM
// ============================================
async function confirmAppt(id) {
  const result = await Confirm.show({
    title: 'Confirm Appointment?',
    message: 'This will notify the customer.',
    confirmText: 'Yes, Confirm',
    cancelText: 'Cancel',
    type: 'info'
  });

  if (!result) return;

  try {
    const res = await fetch(`${API_URL}/api/admin/appointments/${id}/confirm`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      Toast.success('Appointment confirmed!');
      loadStats();
      loadAppointments();
    } else {
      Toast.error(data.message);
    }
  } catch (err) {
    console.error('❌ Confirm error:', err);
    Toast.error('Network error. Please try again.');
  }
}

// ============================================
// ACTIONS — CANCEL
// ============================================
async function cancelAppt(id) {
  const result = await Confirm.show({
    title: 'Cancel Appointment?',
    message: 'Please provide a reason for cancelling.',
    confirmText: 'Yes, Cancel',
    cancelText: 'Go Back',
    type: 'danger',
    requireReason: true,
    reasonPlaceholder: 'Reason for cancellation...'
  });

  if (!result || !result.confirmed) return;

  try {
    const res = await fetch(`${API_URL}/api/admin/appointments/${id}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reason: result.reason })
    });
    const data = await res.json();

    if (data.success) {
      Toast.success('Appointment cancelled!');
      loadStats();
      loadAppointments();
    } else {
      Toast.error(data.message);
    }
  } catch (err) {
    console.error('❌ Cancel error:', err);
    Toast.error('Network error. Please try again.');
  }
}

// ============================================
// ACTIONS — COMPLETE (MAY RECEIPT NA)
// ============================================
async function completeAppt(id) {
  const result = await Confirm.show({
    title: 'Mark as Completed?',
    message: 'This will mark the appointment as completed and generate a receipt.',
    confirmText: 'Yes, Complete',
    cancelText: 'Go Back',
    type: 'success'
  });

  if (!result) return;

  try {
    const res = await fetch(`${API_URL}/api/admin/appointments/${id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      Toast.success('Appointment completed!');
      
      const apptRes = await fetch(`${API_URL}/api/admin/appointments?search=`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const apptData = await apptRes.json();
      
      if (apptData.success) {
        const completedAppt = apptData.appointments.find(a => a._id === id);
        if (completedAppt) {
            showReceipt(completedAppt);
        }
      }

      loadStats();
      loadAppointments();
    } else {
      Toast.error(data.message);
    }
  } catch (err) {
    console.error('❌ Complete error:', err);
    Toast.error('Network error. Please try again.');
  }
}

// ============================================
// ACTIONS — VERIFY PAYMENT
// ============================================
async function verifyPayment(id) {
    const result = await Confirm.show({
        title: 'Verify Payment?',
        message: 'Are you sure the receipt is valid and the payment is correct?',
        confirmText: 'Yes, Verify',
        type: 'success'
    });

    if (!result) return;

    try {
        const res = await fetch(`${API_URL}/api/admin/appointments/${id}/verify-payment`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            Toast.success('Payment verified!');
            loadStats();
            loadAppointments();
        } else {
            Toast.error(data.message);
        }
    } catch (err) {
        Toast.error('Network error. Please try again.');
    }
}

// ============================================
// TAB SWITCHER
// ============================================
function switchTab(tabName) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dash-tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`.dash-tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'services') {
    loadServices();
  } else if (tabName === 'staff') {
    loadStaff();
  } else if (tabName === 'reports') {
    loadReports('all', document.querySelector('#tab-reports .filter-btn:last-child'));
  } else if (tabName === 'schedules') {
    loadScheduleStaffDropdown();
  } else if (tabName === 'feedbacks') {
    loadFeedbacks();
  }
}

// ============================================
// SERVICES MANAGEMENT
// ============================================
async function loadServices() {
  const list = document.getElementById('servicesList');
  if (!list) return;

  list.innerHTML = `
    <div class="loading">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p>Loading services...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_URL}/api/services/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (!data.success || data.services.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-spa"></i>
          <h3>Wala Pang Services</h3>
        </div>
      `;
      return;
    }

    allServices = data.services;
    list.innerHTML = data.services.map(s => renderServiceRow(s)).join('');

  } catch (err) {
    console.error('❌ Load services error:', err);
    list.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function renderServiceRow(s) {
  const categoryIcons = {
    'Hair': '💇', 'Nails': '💅', 'Skin': '✨',
    'Body': '💆', 'Makeup': '💄', 'Lashes & Brows': '👁️'
  };

  return `
    <div class="service-row ${s.status === 'Inactive' ? 'inactive' : ''}">
      <div class="service-info">
        <div class="service-name">
          ${categoryIcons[s.category] || '📌'} ${s.serviceName}
          <span class="service-badge">${s.status}</span>
        </div>
        <div class="service-meta">
          <span><i class="fa-solid fa-tag"></i> ${s.category}</span>
          <span><i class="fa-solid fa-peso-sign"></i> ${s.price}</span>
          <span><i class="fa-solid fa-clock"></i> ${s.duration} mins</span>
        </div>
        ${s.description ? `<div style="font-size:12px; color:#999; margin-top:5px;">${s.description}</div>` : ''}
      </div>
      <div class="service-actions">
        <button class="icon-btn edit" onclick="editService('${s._id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="icon-btn delete" onclick="deleteService('${s._id}', '${s.serviceName}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function openServiceModal(service = null) {
  const modal = document.getElementById('serviceModal');
  const form = document.getElementById('serviceForm');
  const title = document.getElementById('modalTitle');

  form.reset();
  document.getElementById('serviceId').value = '';

  if (service) {
    title.textContent = 'Edit Service';
    document.getElementById('serviceId').value = service._id;
    document.getElementById('svcName').value = service.serviceName;
    document.getElementById('svcCategory').value = service.category;
    document.getElementById('svcDescription').value = service.description || '';
    document.getElementById('svcPrice').value = service.price;
    document.getElementById('svcDuration').value = service.duration;
    document.getElementById('svcStatus').value = service.status;
  } else {
    title.textContent = 'Add Service';
  }

  modal.classList.add('show');
}

function closeServiceModal() {
  const modal = document.getElementById('serviceModal');
  if (modal) modal.classList.remove('show');
}

function editService(id) {
  const service = allServices.find(s => s._id === id);
  if (service) openServiceModal(service);
}

document.getElementById('serviceForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('serviceId').value;
  const data = {
    serviceName: document.getElementById('svcName').value.trim(),
    category: document.getElementById('svcCategory').value,
    description: document.getElementById('svcDescription').value.trim(),
    price: Number(document.getElementById('svcPrice').value),
    duration: Number(document.getElementById('svcDuration').value),
    status: document.getElementById('svcStatus').value
  };

  if (!data.serviceName || !data.category || !data.price || !data.duration) {
    return alert('Please fill all required fields');
  }

  const btn = document.getElementById('svcSubmitBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    const url = id ? `${API_URL}/api/services/${id}` : `${API_URL}/api/services`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      alert('✅ ' + result.message);
      closeServiceModal();
      loadServices();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (err) {
    alert('⚠️ Network error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

async function deleteService(id, name) {
  const result = await Confirm.show({
    title: 'Delete Service?',
    message: `Delete "${name}"? This cannot be undone!`,
    confirmText: 'Yes, Delete',
    type: 'danger'
  });

  if (!result) return;

  try {
    const res = await fetch(`${API_URL}/api/services/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.success) {
      Toast.success(data.message);
      loadServices();
    } else {
      Toast.error(data.message);
    }
  } catch (err) {
    Toast.error('Network error. Please try again.');
  }
}

// ============================================
// STAFF MANAGEMENT
// ============================================
async function loadStaff() {
  const list = document.getElementById('staffList');
  if (!list) return;

  list.innerHTML = `
    <div class="loading">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p>Loading staff...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_URL}/api/staff/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success || data.staff.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-users"></i>
          <h3>Wala Pang Staff</h3>
        </div>
      `;
      return;
    }

    allStaff = data.staff;
    list.innerHTML = data.staff.map(s => renderStaffRow(s)).join('');

  } catch (err) {
    console.error('❌ Load staff error:', err);
    list.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function renderStaffRow(s) {
  const serviceNames = s.services?.slice(0, 3).map(svc => svc.serviceName).join(', ') || 'Wala pang services';
  const moreCount = s.services?.length > 3 ? ` +${s.services.length - 3} more` : '';
  const statusClass = s.status.replace(' ', '');
  const photo = s.photo || 'image/erica.jpg';

  return `
    <div class="staff-row ${s.status === 'Inactive' ? 'inactive' : ''}">
      <div class="staff-info">
        <img src="${photo}" alt="${s.name}" class="staff-avatar" onerror="this.src='image/erica.jpg'">
        <div style="flex: 1;">
          <div class="staff-name-row">
            ${s.name}
            <span class="staff-status-badge staff-status-${statusClass}">${s.status}</span>
          </div>
          <div class="staff-meta">
            ${s.specialization?.length ? `<span><i class="fa-solid fa-star"></i> ${s.specialization.join(', ')}</span>` : ''}
            ${s.contactNumber ? `<span><i class="fa-solid fa-phone"></i> ${s.contactNumber}</span>` : ''}
          </div>
          <div class="staff-services-list">
            💅 ${serviceNames}${moreCount}
          </div>
        </div>
      </div>
      <div class="service-actions">
        <button class="icon-btn edit" onclick="editStaff('${s._id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="icon-btn delete" onclick="deleteStaff('${s._id}', '${s.name}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

async function openStaffModal(staff = null) {
  const modal = document.getElementById('staffModal');
  const form = document.getElementById('staffForm');
  const title = document.getElementById('staffModalTitle');
  const passwordField = document.getElementById('passwordField');

  form.reset();
  document.getElementById('staffId').value = '';

  await loadServicesForStaffDropdown();

  if (staff) {
    title.textContent = 'Edit Staff';
    passwordField.style.display = 'none';

    document.getElementById('staffId').value = staff._id;
    document.getElementById('staffName').value = staff.name;
    document.getElementById('staffEmail').value = staff.email || '';
    document.getElementById('staffContact').value = staff.contactNumber || '';
    document.getElementById('staffSpecialization').value = staff.specialization?.join(', ') || '';
    document.getElementById('staffBio').value = staff.bio || '';
    document.getElementById('staffStatus').value = staff.status;

    const servicesSelect = document.getElementById('staffServices');
    const staffServiceIds = staff.services?.map(s => s._id) || [];
    Array.from(servicesSelect.options).forEach(opt => {
      opt.selected = staffServiceIds.includes(opt.value);
    });
  } else {
    title.textContent = 'Add Staff';
    passwordField.style.display = 'block';
    document.getElementById('staffPassword').required = true;
  }

  modal.classList.add('show');
}

function closeStaffModal() {
  const modal = document.getElementById('staffModal');
  if (modal) modal.classList.remove('show');
  const pwd = document.getElementById('staffPassword');
  if (pwd) pwd.required = false;
}

async function loadServicesForStaffDropdown() {
  const select = document.getElementById('staffServices');
  if (!select || allServicesForStaff.length > 0) return;

  try {
    const res = await fetch(`${API_URL}/api/services/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      allServicesForStaff = data.services;
      select.innerHTML = data.services.map(s =>
        `<option value="${s._id}">${s.serviceName} (${s.category})</option>`
      ).join('');
    }
  } catch (err) {
    console.error('❌ Load services error:', err);
  }
}

function editStaff(id) {
  const staff = allStaff.find(s => s._id === id);
  if (staff) openStaffModal(staff);
}

document.getElementById('staffForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('staffId').value;
  const selectedServices = Array.from(document.getElementById('staffServices').selectedOptions)
    .map(o => o.value)
    .filter(v => v);

  const specializationInput = document.getElementById('staffSpecialization').value.trim();
  const specialization = specializationInput
    ? specializationInput.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const data = {
    name: document.getElementById('staffName').value.trim(),
    email: document.getElementById('staffEmail').value.trim(),
    contactNumber: document.getElementById('staffContact').value.trim(),
    specialization,
    services: selectedServices,
    bio: document.getElementById('staffBio').value.trim(),
    status: document.getElementById('staffStatus').value
  };

  if (!id) {
    const password = document.getElementById('staffPassword').value;
    if (password.length < 6) {
      return alert('Password must be at least 6 characters');
    }
    data.password = password;
  }

  const btn = document.getElementById('staffSubmitBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    const url = id ? `${API_URL}/api/staff/${id}` : `${API_URL}/api/staff`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      alert('✅ ' + result.message);
      closeStaffModal();
      loadStaff();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (err) {
    alert('⚠️ Network error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

async function deleteStaff(id, name) {
  const result = await Confirm.show({
    title: 'Delete Staff?',
    message: `Delete "${name}"? This will also delete their user account. This cannot be undone!`,
    confirmText: 'Yes, Delete',
    type: 'danger'
  });

  if (!result) return;

  try {
    const res = await fetch(`${API_URL}/api/staff/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.success) {
      Toast.success(data.message);
      loadStaff();
    } else {
      Toast.error(data.message);
    }
  } catch (err) {
    Toast.error('Network error. Please try again.');
  }
}

// ============================================
// REPORTS & ANALYTICS
// ============================================
async function loadReports(range = 'all', btn = null) {
  if (btn) {
    document.querySelectorAll('#tab-reports .filter-btn').forEach(b => {
      b.classList.remove('active');
      b.classList.add('inactive');
    });
    btn.classList.remove('inactive');
    btn.classList.add('active');
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/reports?range=${range}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    console.log('📥 Reports:', data);

    if (!data.success) {
      throw new Error(data.message);
    }

    renderReports(data);

  } catch (err) {
    console.error('❌ Reports error:', err);
  }
}

function renderReports(data) {
  // ✅ IDAGDAG ITO PARA MAGBAGO YUNG TITLE
  const titleMap = {
    'all': 'All Time',
    'today': 'Today',
    'week': 'This Week',
    'month': 'This Month'
  };
  const titleEl = document.getElementById('revenueTrendTitle');
  if (titleEl) {
    titleEl.textContent = titleMap[data.range] || 'Last 7 Days';
  }
  const { summary, topServices, topStaff, revenueTrend, categoryBreakdown } = data;

  document.getElementById('repTotal').textContent = summary.totalAppointments;
  document.getElementById('repCompleted').textContent = summary.completedAppointments;
  document.getElementById('repCancelled').textContent = summary.cancelledAppointments;
  document.getElementById('repRevenue').textContent = '₱' + summary.totalRevenue.toLocaleString();
  document.getElementById('repAverage').textContent = '₱' + summary.averagePerAppointment.toFixed(2);
  document.getElementById('repPending').textContent = '₱' + summary.pendingBalance.toLocaleString();

  // TOP SERVICES
  const topServicesContainer = document.getElementById('topServicesList');
  if (topServices.length === 0) {
    topServicesContainer.innerHTML = '<p style="color:#999; text-align:center;">Wala pang data</p>';
  } else {
    topServicesContainer.innerHTML = topServices.map((s, i) => `
      <div class="report-item">
        <span class="rank-badge rank-${i < 3 ? i + 1 : 'other'}">${i + 1}</span>
        <div class="report-item-info">
          <div class="report-item-name">${s.name}</div>
          <div class="report-item-meta">${s.category}</div>
        </div>
        <div class="report-item-value">
          <div class="report-item-count">${s.count}x</div>
          <div class="report-item-revenue">₱${s.revenue.toLocaleString()}</div>
        </div>
      </div>
    `).join('');
  }

  // TOP STAFF
  const topStaffContainer = document.getElementById('topStaffList');
  if (topStaff.length === 0) {
    topStaffContainer.innerHTML = '<p style="color:#999; text-align:center;">Wala pang data</p>';
  } else {
    topStaffContainer.innerHTML = topStaff.map((s, i) => `
      <div class="report-item">
        <span class="rank-badge rank-${i < 3 ? i + 1 : 'other'}">${i + 1}</span>
        <div class="report-item-info">
          <div class="report-item-name">${s.name}</div>
          <div class="report-item-meta">${s.specialization}</div>
        </div>
        <div class="report-item-value">
          <div class="report-item-count">${s.count}x</div>
          <div class="report-item-revenue">₱${s.revenue.toLocaleString()}</div>
        </div>
      </div>
    `).join('');
  }

  // REVENUE TREND
  const revenueContainer = document.getElementById('revenueChart');
  const maxRevenue = Math.max(...revenueTrend.map(r => r.revenue), 1);
  revenueContainer.innerHTML = `
    <div class="chart-bars">
      ${revenueTrend.map(r => {
        const heightPercent = (r.revenue / maxRevenue) * 100;
        return `
          <div class="chart-bar-wrapper">
            <div class="chart-bar-value">₱${r.revenue > 0 ? r.revenue : ''}</div>
            <div class="chart-bar" style="height: ${Math.max(heightPercent, 2)}%;" title="${r.date}: ₱${r.revenue}"></div>
            <div class="chart-bar-label">${r.day}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // CATEGORY BREAKDOWN
  const categoryContainer = document.getElementById('categoryBreakdown');
  const totalCount = categoryBreakdown.reduce((sum, c) => sum + c.count, 0);

  if (categoryBreakdown.length === 0) {
    categoryContainer.innerHTML = '<p style="color:#999; text-align:center;">Wala pang data</p>';
  } else {
    const categoryIcons = {
      'Hair': '💇', 'Nails': '💅', 'Skin': '✨',
      'Body': '💆', 'Makeup': '💄', 'Lashes & Brows': '👁️'
    };

    categoryContainer.innerHTML = categoryBreakdown.map(c => {
      const percent = totalCount > 0 ? (c.count / totalCount) * 100 : 0;
      return `
        <div class="category-bar-wrapper">
          <div class="category-bar-label">
            <span>${categoryIcons[c.category] || '📌'} ${c.category}</span>
            <span>${c.count}x (${percent.toFixed(1)}%)</span>
          </div>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="width: ${percent}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ============================================
// FEEDBACKS MANAGEMENT
// ============================================
async function loadFeedbacks() {
  const list = document.getElementById('feedbacksList');
  if (!list) return;

  list.innerHTML = `
    <div class="loading">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p>Loading feedbacks...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_URL}/api/admin/feedbacks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success || data.feedbacks.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-comment-slash"></i>
          <h3>Wala Pang Feedback</h3>
          <p>Walang feedback na naka-record.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = data.feedbacks.map(fb => {
      const stars = '⭐'.repeat(fb.rating || 5);
      const dateObj = new Date(fb.createdAt);
      
      return `
        <div class="appointment-card" style="border-left-color: #ffc107;">
          <div class="appt-header">
            <div>
              <div class="appt-customer">👤 ${fb.name || 'Anonymous'}</div>
              <div class="appt-contact">📧 ${fb.email || 'No email'}</div>
            </div>
            <span class="appt-status status-Confirmed">
              ${stars}
            </span>
          </div>

          <div style="margin-top: 10px; padding: 15px; background: #f9f9f9; border-radius: 8px; font-size: 14px; color: #555; font-style: italic;">
            "${fb.message || 'No message provided'}"
          </div>

          <div style="margin-top: 10px; font-size: 12px; color: #999; text-align: right;">
            📅 ${dateObj.toLocaleDateString('en-PH')} at ${dateObj.toLocaleTimeString('en-PH')}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('❌ Load feedbacks error:', err);
    list.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ============================================
// PROFILE DROPDOWN + LOGOUT
// ============================================
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');

if (profileBtn && profileDropdown) {
  profileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    profileDropdown.classList.toggle('show');
  });

  document.addEventListener('click', function (e) {
    if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
      profileDropdown.classList.remove('show');
    }
  });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    const result = await Confirm.show({
      title: 'Logout?',
      message: 'Are you sure you want to logout?',
      confirmText: 'Yes, Logout',
      type: 'warning'
    });

    if (result) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
  });
}

// Close modal on ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeServiceModal();
    closeStaffModal();
  }
});

// ============================================
// STAFF SCHEDULES MANAGEMENT
// ============================================
async function loadScheduleStaffDropdown() {
  const select = document.getElementById('scheduleStaffSelect');
  if (!select) return;

  try {
    const res = await fetch(`${API_URL}/api/staff/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      select.innerHTML = '<option value="">-- Pumili ng Staff --</option>' +
        data.staff.map(s => `<option value="${s._id}">${s.name} (${s.specialization?.[0] || 'Staff'})</option>`).join('');
    }
  } catch (err) {
    console.error('❌ Load staff dropdown error:', err);
  }
}

async function loadSchedulesForStaff() {
  const staffId = document.getElementById('scheduleStaffSelect').value;
  const content = document.getElementById('scheduleContent');

  if (!staffId) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-calendar"></i>
        <h3>Pumili ng Staff</h3>
        <p>Piliin ang staff para makita ang schedule</p>
      </div>
    `;
    return;
  }

  currentScheduleStaffId = staffId;

  content.innerHTML = `
    <div class="loading">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p>Loading schedules...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_URL}/api/schedules/staff/${staffId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    currentSchedules = data.schedules;
    currentBlocked = data.blocked;

    renderSchedules();

  } catch (err) {
    console.error('❌ Load schedules error:', err);
    content.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function renderSchedules() {
  const content = document.getElementById('scheduleContent');

  const sortedSchedules = [...currentSchedules].sort((a, b) => a.date.localeCompare(b.date));
  const sortedBlocked = [...currentBlocked].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  content.innerHTML = `
    <div class="schedule-grid">
      <div class="schedule-header-bar">
        <h4>📅 Working Schedules</h4>
        <div class="schedule-actions">
          <button class="filter-btn" onclick="openScheduleModal()">
            <i class="fa-solid fa-plus"></i> Add Schedule
          </button>
        </div>
      </div>

      <div class="schedule-section">
        <h5>🗓️ Schedules (${sortedSchedules.length})</h5>
        ${sortedSchedules.length === 0
          ? '<p style="color:#999; text-align:center; padding:20px;">Wala pang schedule</p>'
          : sortedSchedules.map(s => renderScheduleItem(s)).join('')
        }
      </div>

      <div class="schedule-header-bar" style="margin-top:20px;">
        <h4>🚫 Blocked Times</h4>
        <div class="schedule-actions">
          <button class="filter-btn" onclick="openBlockedModal()">
            <i class="fa-solid fa-plus"></i> Block Time
          </button>
        </div>
      </div>

      <div class="schedule-section">
        <h5>🚫 Blocked (${sortedBlocked.length})</h5>
        ${sortedBlocked.length === 0
          ? '<p style="color:#999; text-align:center; padding:20px;">Walang blocked times</p>'
          : sortedBlocked.map(b => renderBlockedItem(b)).join('')
        }
      </div>
    </div>
  `;
}

function renderScheduleItem(s) {
  const date = new Date(s.date + 'T00:00:00');
  const formatted = date.toLocaleDateString('en-PH', { 
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
  });

  const statusClass = s.status === 'Available' ? 'available'
    : s.status === 'Day Off' ? 'dayoff' : 'halfday';

  const isDayOff = s.status === 'Day Off';

  return `
    <div class="schedule-item ${isDayOff ? 'dayoff' : ''}">
      <div class="schedule-item-info">
        <div class="schedule-item-date">
          ${formatted}
          <span class="schedule-item-badge badge-${statusClass}">${s.status}</span>
        </div>
        <div class="schedule-item-time">
          ${isDayOff ? '🏖️ Day Off' : `⏰ ${s.startTime} - ${s.endTime}`}
        </div>
      </div>
      <div class="service-actions">
        <button class="icon-btn edit" onclick="editSchedule('${s._id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="icon-btn delete" onclick="deleteSchedule('${s._id}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function renderBlockedItem(b) {
  const date = new Date(b.date + 'T00:00:00');
  const formatted = date.toLocaleDateString('en-PH', { 
    weekday: 'short', month: 'short', day: 'numeric' 
  });

  return `
    <div class="schedule-item blocked">
      <div class="schedule-item-info">
        <div class="schedule-item-date">
          ${formatted}
          <span class="schedule-item-badge badge-blocked">${b.reason}</span>
        </div>
        <div class="schedule-item-time">
          ⏰ ${b.startTime} - ${b.endTime}
          ${b.notes ? `<br><small style="color:#999;">${b.notes}</small>` : ''}
        </div>
      </div>
      <div class="service-actions">
        <button class="icon-btn edit" onclick="editBlocked('${b._id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="icon-btn delete" onclick="deleteBlocked('${b._id}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

// ============================================
// SCHEDULE MODAL
// ============================================
function openScheduleModal(schedule = null) {
  const modal = document.getElementById('scheduleModal');
  const form = document.getElementById('scheduleForm');
  const title = document.getElementById('scheduleModalTitle');

  form.reset();
  document.getElementById('scheduleId').value = '';

  if (schedule) {
    title.textContent = 'Edit Schedule';
    document.getElementById('scheduleId').value = schedule._id;
    document.getElementById('schDate').value = schedule.date;
    document.getElementById('schStart').value = schedule.startTime;
    document.getElementById('schEnd').value = schedule.endTime;
    document.getElementById('schStatus').value = schedule.status;
  } else {
    title.textContent = 'Add Schedule';
    document.getElementById('schDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('schStart').value = '09:00';
    document.getElementById('schEnd').value = '18:00';
    document.getElementById('schStatus').value = 'Available';
  }

  modal.classList.add('show');
}

function closeScheduleModal() {
  const modal = document.getElementById('scheduleModal');
  if (modal) modal.classList.remove('show');
}

function editSchedule(id) {
  const s = currentSchedules.find(x => x._id === id);
  if (s) openScheduleModal(s);
}

document.getElementById('scheduleForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('scheduleId').value;
  const data = {
    staffId: currentScheduleStaffId,
    date: document.getElementById('schDate').value,
    startTime: document.getElementById('schStart').value,
    endTime: document.getElementById('schEnd').value,
    status: document.getElementById('schStatus').value
  };

  if (data.status === 'Day Off') {
    data.startTime = '00:00';
    data.endTime = '00:00';
  }

  const btn = document.getElementById('schSubmitBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    const url = id ? `${API_URL}/api/schedules/${id}` : `${API_URL}/api/schedules`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      alert('✅ ' + result.message);
      closeScheduleModal();
      loadSchedulesForStaff();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (err) {
    alert('⚠️ Network error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
});

async function deleteSchedule(id) {
  const result = await Confirm.show({
    title: 'Delete Schedule?',
    message: 'This will remove the schedule for this date.',
    confirmText: 'Yes, Delete',
    type: 'danger'
  });

  if (!result) return;

  try {
    const res = await fetch(`${API_URL}/api/schedules/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      Toast.success('Schedule deleted!');
      loadSchedulesForStaff();
    } else {
      Toast.error(data.message);
    }
  } catch (err) {
    Toast.error('Network error. Please try again.');
  }
}

// ============================================
// BLOCKED TIME MODAL
// ============================================
function openBlockedModal(blocked = null) {
  const modal = document.getElementById('blockedModal');
  const form = document.getElementById('blockedForm');
  const title = document.getElementById('blockedModalTitle');

  form.reset();
  document.getElementById('blockedId').value = '';

  if (blocked) {
    title.textContent = 'Edit Blocked Time';
    document.getElementById('blockedId').value = blocked._id;
    document.getElementById('blkDate').value = blocked.date;
    document.getElementById('blkStart').value = blocked.startTime;
    document.getElementById('blkEnd').value = blocked.endTime;
    document.getElementById('blkReason').value = blocked.reason;
    document.getElementById('blkNotes').value = blocked.notes || '';
  } else {
    title.textContent = 'Block Time';
    document.getElementById('blkDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('blkStart').value = '12:00';
    document.getElementById('blkEnd').value = '13:00';
    document.getElementById('blkReason').value = 'Lunch Break';
    document.getElementById('blkNotes').value = '';
  }

  modal.classList.add('show');
}

function closeBlockedModal() {
  const modal = document.getElementById('blockedModal');
  if (modal) modal.classList.remove('show');
}

function editBlocked(id) {
  const b = currentBlocked.find(x => x._id === id);
  if (b) openBlockedModal(b);
}

document.getElementById('blockedForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('blockedId').value;
  const data = {
    staffId: currentScheduleStaffId,
    date: document.getElementById('blkDate').value,
    startTime: document.getElementById('blkStart').value,
    endTime: document.getElementById('blkEnd').value,
    reason: document.getElementById('blkReason').value,
    notes: document.getElementById('blkNotes').value
  };

  const btn = document.getElementById('blkSubmitBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    const url = id ? `${API_URL}/api/schedules/blocked/${id}` : `${API_URL}/api/schedules/blocked`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      alert('✅ ' + result.message);
      closeBlockedModal();
      loadSchedulesForStaff();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (err) {
    alert('⚠️ Network error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
});

async function deleteBlocked(id) {
  const result = await Confirm.show({
    title: 'Delete Blocked Time?',
    message: 'This will remove the blocked schedule.',
    confirmText: 'Yes, Delete',
    type: 'danger'
  });

  if (!result) return;

  try {
    const res = await fetch(`${API_URL}/api/schedules/blocked/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      Toast.success('Blocked time removed!');
      loadSchedulesForStaff();
    } else {
      Toast.error(data.message);
    }
  } catch (err) {
    Toast.error('Network error. Please try again.');
  }
}

// ============================================
// RECEIPT FUNCTIONS
// ============================================
function showReceipt(appt) {
    const modal = document.getElementById('receiptModal');
    const content = document.getElementById('receiptContent');
    
    if(!modal || !content) {
        alert('Receipt modal not found in HTML.');
        return;
    }

    const paid = appt.totalAmount - (appt.remainingBalance || 0);
    
    const services = appt.services || [];
    const servicesList = services.map(s => `
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px;">
            <span>${s.serviceId?.serviceName || 'Service'}</span>
            <span>₱${(s.price || 0).toFixed(2)}</span>
        </div>
    `).join('');

    const dateObj = new Date(appt.createdAt || Date.now());
    const receiptNo = appt._id.slice(-6).toUpperCase();

    content.innerHTML = `
        <div id="printableReceipt" style="font-family: 'DM Sans', sans-serif; color: #333;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="font-family: 'Cormorant Garamond', serif; color: var(--burgundy); margin: 0; font-size: 28px;">Erica Salon</h2>
                <p style="font-size: 11px; color: #666; margin: 5px 0;">Your journey to Elegance and Beauty</p>
                <p style="font-size: 10px; color: #999;">Blk 20 Lot 12 Phase 3 Golden Hills Panorama, Marilao</p>
            </div>

            <div style="border-top: 2px dashed #ccc; border-bottom: 2px dashed #ccc; padding: 10px 0; margin-bottom: 15px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Receipt No:</span><strong>#${receiptNo}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Date:</span><strong>${dateObj.toLocaleDateString('en-PH')}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Customer:</span><strong>${appt.customerId?.name || 'Customer'}</strong>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                ${servicesList.length > 0 ? servicesList : '<p style="text-align:center; color:#999; font-size:12px;">No services listed</p>'}
            </div>

            <div style="border-top: 2px dashed #ccc; padding-top: 10px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Total Amount:</span>
                    <strong>₱${(appt.totalAmount || 0).toFixed(2)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #28a745;">
                    <span>Paid:</span>
                    <strong>₱${paid.toFixed(2)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 10px; color: var(--burgundy);">
                    <span>Balance:</span>
                    <span>₱${(appt.remainingBalance || 0).toFixed(2)}</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 25px; font-size: 11px; color: #888;">
                <p>Thank you for choosing Erica Salon!</p>
                <p>Please come again ✨</p>
            </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="document.getElementById('receiptModal').classList.remove('show')" 
                    style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: #eee; color: #333; font-weight: bold; cursor: pointer;">
                Close
            </button>
            <button onclick="printReceipt()" 
                    style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: var(--burgundy); color: white; font-weight: bold; cursor: pointer;">
                <i class="fa-solid fa-print"></i> Print
            </button>
        </div>
    `;

    modal.classList.add('show');
}

function printReceipt() {
    const printContent = document.getElementById('printableReceipt').innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = `
        <div style="width: 100%; max-width: 350px; margin: 0 auto; padding: 20px;">
            ${printContent}
        </div>
    `;

    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
}

// ============================================
// INIT
// ============================================
loadStats();
loadAppointments();