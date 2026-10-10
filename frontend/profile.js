// ============================================
// ERICA SALON — Profile Logic
// ============================================

console.log('👤 profile.js loaded');

const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  alert('Please login first');
  window.location.href = 'login.html';
}

// ============================================
// LOAD PROFILE
// ============================================
async function loadProfile() {
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('📥 Profile:', data);

    if (!data.success) {
      alert(data.message);
      return;
    }

    const u = data.user;
    const c = data.customer;

    // Header
    document.getElementById('profileName').textContent = u.name;
    document.getElementById('profileEmail').textContent = u.email;
    document.getElementById('profileRole').textContent = u.role;

    // Stats
    if (c) {
      document.getElementById('totalVisits').textContent = c.totalVisits || 0;
      document.getElementById('totalSpent').textContent = '₱' + (c.totalSpent || 0).toLocaleString();
    }
    document.getElementById('memberSince').textContent = new Date(u.createdAt).getFullYear();

    // Info tab
    document.getElementById('infoName').textContent = u.name;
    document.getElementById('infoEmail').textContent = u.email;
    document.getElementById('infoContact').textContent = u.contactNumber || '—';
    document.getElementById('infoRole').textContent = u.role;
    document.getElementById('infoCreated').textContent = formatDate(u.createdAt);
    document.getElementById('infoLastLogin').textContent = u.lastLogin ? formatDate(u.lastLogin) : 'First time';
    document.getElementById('infoNotes').textContent = c?.notes || '—';

    // Edit form — pre-fill
    document.getElementById('editName').value = u.name;
    document.getElementById('editContact').value = u.contactNumber || '';
    document.getElementById('editNotes').value = c?.notes || '';

    // Update dropdown
    document.getElementById('dropdownName').textContent = u.name;
    document.getElementById('dropdownEmail').textContent = u.email;

  } catch (err) {
    console.error('❌ Load profile error:', err);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================
// TAB SWITCHER
// ============================================
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`.tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ============================================
// UPDATE PROFILE
// ============================================
document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('editName').value.trim();
  const contactNumber = document.getElementById('editContact').value.trim();
  const notes = document.getElementById('editNotes').value.trim();

  if (!name) {
    return alert('Name is required');
  }

  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, contactNumber, notes })
    });

    const data = await res.json();
    console.log('📥 Update response:', data);

    if (data.success) {
      Toast.success('Profile updated!');
      // Update localStorage
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.name = name;
      localStorage.setItem('user', JSON.stringify(storedUser));

      // Reload profile
      loadProfile();
      switchTab('info');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    console.error('❌ Update error:', err);
    alert('⚠️ Network error');
  }
});

// ============================================
// CHANGE PASSWORD
// ============================================
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    return alert('New passwords do not match');
  }

  if (newPassword.length < 6) {
    return alert('Password must be at least 6 characters');
  }

  try {
    const res = await fetch(`${API_URL}/api/profile/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });

    const data = await res.json();
    console.log('📥 Password response:', data);

    if (data.success) {
      alert('✅ ' + data.message);
      document.getElementById('passwordForm').reset();
      switchTab('info');
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    console.error('❌ Password error:', err);
    alert('⚠️ Network error');
  }
});

// ============================================
// PROFILE DROPDOWN
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

// ============================================
// LOGOUT
// ============================================
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
  });
}

// ============================================
// MOBILE MENU
// ============================================
const menuButton = document.getElementById('menuButton');
const navLinks = document.getElementById('navLinks');
if (menuButton && navLinks) {
  menuButton.addEventListener('click', function () {
    navLinks.classList.toggle('active');
  });
}

// ============================================
// INIT
// ============================================
loadProfile();