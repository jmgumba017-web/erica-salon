// ============================================
// ERICA SALON — Staff Dashboard Logic
// ============================================

console.log('💇 staff-dashboard.js loaded');

const API_URL = window.location.origin;
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) {
  alert('Please login first');
  window.location.href = 'login.html';
}

if (user.role !== 'Staff') {
  alert('Access denied. Staff only.');
  if (user.role === 'Admin') {
    window.location.href = 'dashboard.html';
  } else {
    window.location.href = 'homepage.html';
  }
}

document.getElementById('staffName').textContent = user.name || 'Staff';
document.getElementById('dropdownName').textContent = user.name || 'Staff';
document.getElementById('dropdownEmail').textContent = user.email || '';

let allAppointments = [];

// ============================================
// LOAD STATS
// ============================================
async function loadStats() {
  try {
    const res = await fetch(`${API_URL}/api/staff/my-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('statTotal').textContent = data.stats.totalAssigned;
      document.getElementById('statToday').textContent = data.stats.todayAssigned;
      document.getElementById('statPending').textContent = data.stats.pending;
      document.getElementById('statCompleted').textContent = data.stats.completed;
    }
  } catch (err) {
    console.error('❌ Stats error:', err);
  }
}

// ============================================
// LOAD APPOINTMENTS
// ============================================
async function loadAppointments() {
  try {
    const res = await fetch(`${API_URL}/api/staff/my-appointments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    console.log('📥 My appointments:', data);

    if (!data.success) {
      throw new Error(data.message);
    }

    allAppointments = data.appointments;
    renderLists();

  } catch (err) {
    console.error('❌ Load appointments error:', err);
    document.getElementById('upcomingList').innerHTML =
      `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ============================================
// RENDER LISTS
// ============================================
function renderLists() {
  // Upcoming (Pending/Confirmed/In Progress)
  const upcoming = allAppointments.filter(a =>
    ['Pending', 'Confirmed', 'In Progress'].includes(a.appointment.status)
  );

  // Completed
  const completed = allAppointments.filter(a =>
    a.appointment.status === 'Completed'
  );

  renderList('upcomingList', upcoming, 'Wala pang upcoming appointments');
  renderList('completedList', completed, 'Wala pang completed appointments');
  renderList('allList', allAppointments, 'Wala pang appointments');
}

function renderList(containerId, list, emptyMessage) {
  const container = document.getElementById(containerId);

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-calendar-xmark"></i>
        <h3>${emptyMessage}</h3>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(a => renderApptCard(a)).join('');
}

function renderApptCard(item) {
  const appt = item.appointment;
  const services = item.services;

  const servicesHTML = services.map(s => `
    <li>
      <span>
        💅 <strong>${s.serviceId?.serviceName || 'Service'}</strong> 
        — ₱${s.price} (${s.duration} mins)
        <span class="appt-status status-${s.status.replace(' ', '')}" style="margin-left: 8px; font-size: 10px;">
          ${s.status}
        </span>
      </span>
      ${s.status !== 'Completed' ? `
        <button class="service-complete-btn" onclick="completeService('${s._id}')">
          <i class="fa-solid fa-check"></i> Complete
        </button>
      ` : ''}
    </li>
  `).join('');

  return `
    <div class="appt-card status-${appt.status.replace(' ', '')}">
      <div class="appt-header">
        <div>
          <div class="appt-customer">👤 ${appt.customerId?.name || 'Customer'}</div>
          <div class="appt-contact">
            📱 ${appt.customerId?.contactNumber || 'N/A'} • 
            📧 ${appt.customerId?.email || 'N/A'}
          </div>
        </div>
        <span class="appt-status status-${appt.status.replace(' ', '')}">
          ${appt.status}
        </span>
      </div>

      <div class="appt-details">
        <div>📅 <strong>${appt.appointmentDate}</strong></div>
        <div>⏰ <strong>${appt.appointmentTime}</strong> — ${appt.endTime || '?'}</div>
        <div>💰 Total: <strong>₱${appt.totalAmount.toFixed(2)}</strong></div>
      </div>

      <ul class="appt-services">
        ${servicesHTML}
      </ul>

      ${appt.notes ? `<div style="font-size:13px; color:#666; font-style:italic; margin-top:10px;">📝 "${appt.notes}"</div>` : ''}
    </div>
  `;
}

// ============================================
// COMPLETE SERVICE
// ============================================
async function completeService(assignmentId) {
  const result = await Confirm.show({
    title: 'Complete Service?',
    message: 'Mark this service as completed.',
    confirmText: 'Yes, Complete',
    type: 'success'
});
if (!result) return;

  try {
    const res = await fetch(`${API_URL}/api/staff/appointments/${assignmentId}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.success) {
    Toast.success(data.message);
    loadStats();
    loadAppointments();
} else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    console.error('❌ Complete error:', err);
    alert('⚠️ Network error');
  }
}

// ============================================
// TAB SWITCHER
// ============================================
function switchStaffTab(tabName) {
  document.querySelectorAll('.staff-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.staff-tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`.staff-tab[onclick="switchStaffTab('${tabName}')"]`).classList.add('active');
  document.getElementById(`stafftab-${tabName}`).classList.add('active');
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
  logoutBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (confirm('Logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
  });
}

// ============================================
// INIT
// ============================================
loadStats();
loadAppointments();