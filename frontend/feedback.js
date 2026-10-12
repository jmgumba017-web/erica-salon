// ============================================
// ERICA SALON — Feedback Logic
// ============================================

console.log('💬 feedback.js loaded');

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? window.location.origin
  : 'https://erica-salon.onrender.com';

// ============================================
// RATING LABEL
// ============================================
const ratingLabels = {
  1: '😞 Poor',
  2: '😐 Fair',
  3: '🙂 Good',
  4: '😊 Very Good',
  5: '🤩 Excellent!'
};

document.querySelectorAll('input[name="rating"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const label = document.getElementById('ratingLabel');
    if (label) label.textContent = ratingLabels[radio.value] || '';
  });
});

// ============================================
// CHARACTER COUNT
// ============================================
const messageInput = document.getElementById('message');
const charCount = document.getElementById('charCount');

if (messageInput && charCount) {
  messageInput.addEventListener('input', () => {
    charCount.textContent = messageInput.value.length;
  });
}

// ============================================
// SHOW MESSAGE
// ============================================
function showMessage(text, type = 'success') {
  const box = document.getElementById('messageBox');
  if (!box) return;

  box.textContent = text;
  box.className = `message show ${type}`;

  setTimeout(() => {
    box.classList.remove('show');
  }, 5000);
}

// ============================================
// SUBMIT FEEDBACK
// ============================================
const feedbackForm = document.getElementById('feedbackForm');

if (feedbackForm) {
  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    const category = document.getElementById('category').value;
    const message = document.getElementById('message').value.trim();

    // Validation
    if (!name) {
      return showMessage('⚠️ Please enter your name', 'error');
    }

    if (!rating) {
      return showMessage('⚠️ Please select a rating', 'error');
    }

    if (!message) {
      return showMessage('⚠️ Please write your feedback', 'error');
    }

    if (message.length > 1000) {
      return showMessage('⚠️ Message is too long (max 1000 characters)', 'error');
    }

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          rating: parseInt(rating),
          category,
          message
        })
      });

      const data = await res.json();
      console.log('📥 Feedback response:', data);

      if (data.success) {
        showMessage('✅ ' + data.message, 'success');
        feedbackForm.reset();
        charCount.textContent = '0';
        document.getElementById('ratingLabel').textContent = 'Pumili ng rating';

        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = 'homepage.html';
        }, 3000);
      } else {
        showMessage('❌ ' + (data.message || 'Failed to submit'), 'error');
      }
    } catch (err) {
      console.error('❌ Feedback error:', err);
      showMessage('⚠️ Network error. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}