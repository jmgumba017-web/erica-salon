// ============================================
// ERICA SALON — Payment Logic
// ============================================

console.log('💳 payment.js loaded');

const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  alert('Please login first');
  window.location.href = 'login.html';
}

// Get appointment ID from URL
const params = new URLSearchParams(window.location.search);
const appointmentId = params.get('id');

let currentAppointment = null;

// ============================================
// LOAD APPOINTMENT DETAILS
// ============================================
async function loadAppointment() {
  if (!appointmentId) {
    alert('No appointment selected');
    window.location.href = 'history.html';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/appointments/${appointmentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    console.log('📥 Appointment:', data);

    if (!data.success) {
      alert('Appointment not found');
      window.location.href = 'history.html';
      return;
    }

    currentAppointment = data.appointment;
    renderSummary(data.appointment, data.services);

  } catch (err) {
    console.error('❌ Error:', err);
    alert('Error loading appointment');
  }
}

function renderSummary(appointment, services) {
  const paid = appointment.totalAmount - appointment.remainingBalance;

  const servicesHTML = services.map(s => `
    <div class="service-line">
      • ${s.serviceId?.serviceName} — ₱${s.price}
    </div>
  `).join('');

  document.getElementById('appointmentSummary').innerHTML = `
    <div class="appointment-summary">
      <div class="summary-header">
        📅 ${appointment.appointmentDate} — ${appointment.appointmentTime}
      </div>
      <div style="margin-bottom: 15px;">
        ${servicesHTML}
      </div>
      <div class="summary-row">
        <span>Total Amount:</span>
        <strong>₱${appointment.totalAmount.toFixed(2)}</strong>
      </div>
      <div class="summary-row">
        <span>Already Paid:</span>
        <strong style="color:#28a745;">₱${paid.toFixed(2)}</strong>
      </div>
      <div class="summary-row total">
        <span>Balance Due:</span>
        <span>₱${appointment.remainingBalance.toFixed(2)}</span>
      </div>
    </div>
  `;

  // ✅ Pre-fill amount — kung first-time at may down payment, 50% lang
  const amountInput = document.getElementById('amount');
  if (amountInput) {
    const isDownPayment = appointment.requireDownPayment && appointment.downPayment === 0;

    if (isDownPayment) {
      const downAmount = appointment.totalAmount * 0.5;
      amountInput.value = downAmount.toFixed(2);
      amountInput.max = downAmount;
      amountInput.min = downAmount;

      showMessage(`💰 First-time customer: 50% down payment required (₱${downAmount.toFixed(2)})`, 'info');
    } else {
      amountInput.value = appointment.remainingBalance.toFixed(2);
      amountInput.max = appointment.remainingBalance;
    }
  }

  // Show form
  document.getElementById('paymentForm').style.display = 'block';

  // ✅ Update sidebar summary
  const sidebarDate = document.getElementById('sidebarDate');
  const sidebarTime = document.getElementById('sidebarTime');
  const sidebarTotal = document.getElementById('sidebarTotal');
  const sidebarPaid = document.getElementById('sidebarPaid');
  const sidebarBalance = document.getElementById('sidebarBalance');

  if (sidebarDate) sidebarDate.textContent = appointment.appointmentDate;
  if (sidebarTime) sidebarTime.textContent = appointment.appointmentTime;
  if (sidebarTotal) sidebarTotal.textContent = '₱' + appointment.totalAmount.toFixed(2);
  if (sidebarPaid) sidebarPaid.textContent = '₱' + paid.toFixed(2);
  if (sidebarBalance) sidebarBalance.textContent = '₱' + appointment.remainingBalance.toFixed(2);
}

// ============================================
// SUBMIT PAYMENT
// ============================================
const paymentForm = document.getElementById('paymentForm');

if (paymentForm) {
  // ============================================
// SUBMIT PAYMENT (with receipt upload)
// ============================================
const paymentForm = document.getElementById('paymentForm');

if (paymentForm) {
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amountInput = document.getElementById('amount');
    const refInput = document.getElementById('referenceNumber');
    const notesInput = document.getElementById('notes');

    const amount = parseFloat(amountInput?.value || 0);
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    const referenceNumber = refInput?.value || '';
    const notes = notesInput?.value || '';

    if (!amount || amount <= 0) {
      return alert('Please enter a valid amount');
    }

    if (amount > currentAppointment.remainingBalance) {
      return alert(`Amount cannot exceed ₱${currentAppointment.remainingBalance.toFixed(2)}`);
    }

    // ✅ Determine payment type
    let paymentType = 'Balance';
    const alreadyPaid = currentAppointment.totalAmount - currentAppointment.remainingBalance;

    if (currentAppointment.requireDownPayment && currentAppointment.downPayment === 0) {
      paymentType = 'Down Payment';
    } else if (alreadyPaid === 0 && amount < currentAppointment.totalAmount) {
      paymentType = 'Down Payment';
    } else if (amount >= currentAppointment.remainingBalance) {
      paymentType = alreadyPaid > 0 ? 'Balance' : 'Full Payment';
    }

    const payBtn = document.getElementById('payBtn');
    const originalText = payBtn ? payBtn.innerHTML : '';

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    }

    try {
      // ✅ Use FormData para sa file upload
      const formData = new FormData();
      formData.append('appointmentId', appointmentId);
      formData.append('amount', amount);
      formData.append('paymentMethod', paymentMethod);
      formData.append('referenceNumber', referenceNumber);
      formData.append('paymentType', paymentType);
      formData.append('notes', notes);

      // ✅ Idagdag ang receipt kung mayroon
      const receipt = window.getSelectedReceipt ? window.getSelectedReceipt() : null;
      if (receipt) {
        formData.append('receipt', receipt);
      }

      const res = await fetch(`${API_URL}/api/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // ⚠️ HUWAG mag-set ng 'Content-Type' — FormData na ang bahala
        },
        body: formData
      });

      const data = await res.json();
      console.log('📥 Payment response:', data);

      if (data.success) {
        if (typeof Toast !== 'undefined' && Toast.success) {
          Toast.success(`Payment successful! Amount: ₱${amount.toFixed(2)}`);
        } else {
          alert(`✅ Payment successful! Amount: ₱${amount.toFixed(2)}`);
        }

        setTimeout(() => {
          window.location.href = 'history.html';
        }, 1500);
      } else {
        alert('❌ ' + (data.message || 'Payment failed'));
      }
    } catch (err) {
      console.error('❌ Payment error:', err);
      alert('⚠️ Network error. Please try again.');
    } finally {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = originalText || '<i class="fa-solid fa-credit-card"></i> Confirm Payment';
      }
    }
  });
}
}

// ============================================
// HELPER: Show message (kung walang Toast library)
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

  const form = document.getElementById('paymentForm') || document.querySelector('.login-form');
  if (form && form.parentNode) {
    form.parentNode.insertBefore(div, form);
  } else {
    document.body.insertBefore(div, document.body.firstChild);
  }
  setTimeout(() => div.remove(), 5000);
}

// Initialize
loadAppointment();