// ============================================
// ERICA SALON — Frontend Auth Logic
// Flow: Register → Login → Calendar → Appointment
// ============================================

console.log('🔐 auth.js loaded');

// ============================================
// HELPER: Get API base URL
// ============================================
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? window.location.origin
  : 'https://erica-salon.onrender.com';

// ============================================
// HELPER: Save user session
// ============================================
function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  console.log('💾 Session saved:', user.email);
}

// ============================================
// HELPER: Show message
// ============================================
function showMessage(message, type = 'info') {
  // Remove existing messages
  const existing = document.querySelector('.auth-message');
  if (existing) existing.remove();

  // Create new message
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

  // Insert sa taas ng form
  const form = document.querySelector('.login-form');
  if (form) {
    form.parentNode.insertBefore(div, form);
  } else {
    document.querySelector('.login-container').prepend(div);
  }

  // Auto-remove after 5 seconds
  setTimeout(() => div.remove(), 5000);
}

// ============================================
// HELPER: Set button loading state
// ============================================
function setButtonLoading(button, isLoading, originalText) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || originalText;
  }
}

// ============================================
// REGISTER FORM HANDLER
// Redirect: register.html → calendar.html
// ============================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  console.log('📝 Register form detected');

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contactNumber = document.getElementById('contactNumber')?.value.trim() || '';
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (!name || !email || !password) {
      return showMessage('Please fill all required fields', 'error');
    }

    if (password !== confirmPassword) {
      return showMessage('Passwords do not match', 'error');
    }

    if (password.length < 6) {
      return showMessage('Password must be at least 6 characters', 'error');
    }

    setButtonLoading(submitBtn, true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          contactNumber
        })
      });

      const data = await res.json();
      console.log('📥 Register response:', data);

            if (data.success && data.requiresOTP) {
        // Show OTP modal
        showOTPModal(data.email);
      } else if (data.success) {
        // Direct success (for backward compatibility)
        saveSession(data.token, data.user);
        showMessage('✅ ' + data.message, 'success');
        setTimeout(() => {
          window.location.href = 'calendar.html';
        }, 1500);
      } else {
        showMessage('❌ ' + data.message, 'error');
      }
    } catch (err) {
      console.error('❌ Register error:', err);
      showMessage('⚠️ Network error. Please try again.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

// ============================================
// LOGIN FORM HANDLER
// Redirect: login.html → calendar.html (customer)
//           login.html → dashboard.html (admin)
// ============================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  console.log('🔐 Login form detected');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      return showMessage('Please enter email and password', 'error');
    }

    setButtonLoading(submitBtn, true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      console.log('📥 Login response:', data);

      if (data.success) {
        saveSession(data.token, data.user);
        showMessage('✅ ' + data.message, 'success');

               // Redirect base sa role
        setTimeout(() => {
          if (data.user.role === 'Admin') {
            window.location.href = 'dashboard.html';
          } else if (data.user.role === 'Staff') {
            window.location.href = 'staff-dashboard.html';    // ← BAGO
          } else {
            window.location.href = 'calendar.html';
          }
        }, 1000);
      } else {
        showMessage('❌ ' + data.message, 'error');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      showMessage('⚠️ Network error. Please try again.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

// ============================================
// GOOGLE SIGN-IN
// Redirect: → calendar.html
// ============================================
function handleCredentialResponse(response) {
  console.log('🔵 Google credential received');

  fetch(`${API_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: response.credential })
  })
    .then(res => res.json())
    .then(data => {
      console.log('📥 Google response:', data);

      if (data.success) {
        saveSession(data.token, data.user);
        showMessage('✅ ' + data.message, 'success');

        // Redirect sa calendar
        setTimeout(() => {
          window.location.href = 'calendar.html';
        }, 1500);
      } else {
        showMessage('❌ ' + data.message, 'error');
      }
    })
    .catch(err => {
      console.error('❌ Google error:', err);
      showMessage('⚠️ Google sign-in failed. Please try again.', 'error');
    });
}

// ============================================
// INITIALIZE GOOGLE SIGN-IN
// ============================================
window.addEventListener('load', () => {
  if (typeof google === 'undefined') {
    console.warn('⚠️ Google SDK not loaded');
    return;
  }

  if (!window.GOOGLE_CLIENT_ID || window.GOOGLE_CLIENT_ID.includes('placeholder')) {
    console.warn('⚠️ GOOGLE_CLIENT_ID not set properly');
    return;
  }

  try {
    google.accounts.id.initialize({
      client_id: window.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });

    // Attach sa Google buttons
    const googleSignUpBtn = document.getElementById('googleSignUpBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');

    if (googleSignUpBtn) {
      googleSignUpBtn.addEventListener('click', () => {
        google.accounts.id.prompt();
      });
    }

    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', () => {
        google.accounts.id.prompt();
      });
    }

    console.log('✅ Google Sign-In initialized');
  } catch (err) {
    console.error('❌ Google init error:', err);
  }
});

// ============================================
// CHECK IF ALREADY LOGGED IN
// Kung naka-login na at nasa login/register page,
// i-redirect sa calendar
// ============================================
(function checkAuth() {
  const token = localStorage.getItem('token');
  const currentPage = window.location.pathname.split('/').pop();

  // Kung nasa login o register page at naka-login na, i-redirect sa calendar
  if (token && (currentPage === 'login.html' || currentPage === 'register.html' ||
                currentPage === 'login' || currentPage === 'register')) {
    console.log('✅ Already logged in, redirecting to calendar...');
    window.location.href = 'calendar.html';
  }
})();