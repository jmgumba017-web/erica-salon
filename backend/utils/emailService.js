const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// EMAIL TRANSPORTER
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ============================================
// HELPER: Base HTML Template
// ============================================
function emailTemplate(title, content, buttonText = null, buttonLink = null) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #fdf0f3; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(167, 13, 64, 0.1); }
        .header { background: linear-gradient(135deg, #a70d40, #c2185b); color: white; padding: 35px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; }
        .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
        .content { padding: 35px 30px; color: #2c1810; line-height: 1.6; }
        .content h2 { color: #a70d40; font-size: 24px; margin-top: 0; }
        .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #a70d40, #c2185b); color: white !important; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 15px 0; }
        .info-box { background: #fdf0f3; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #a70d40; }
        .info-row { padding: 8px 0; border-bottom: 1px solid #e6d6d8; }
        .info-row:last-child { border-bottom: none; }
        .info-row strong { color: #a70d40; display: inline-block; min-width: 130px; }
        .footer { background: #f9f0f2; padding: 20px 30px; text-align: center; color: #999; font-size: 12px; }
        .footer-logo { font-size: 20px; font-weight: 700; color: #a70d40; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💅 Erica Salon</h1>
          <p>Your journey to Elegance and Beauty starts with us</p>
        </div>
        <div class="content">
          <h2>${title}</h2>
          ${content}
          ${buttonText && buttonLink ? `<a href="${buttonLink}" class="button">${buttonText}</a>` : ''}
        </div>
        <div class="footer">
          <div class="footer-logo">Erica Salon</div>
          <p>© 2026 Gorgeous Erica Nails & Salon</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// SEND EMAIL (Base Function)
// ============================================

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not set. Skipping email.');
      return { success: false, message: 'Email not configured' };
    }

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Erica Salon <onboarding@resend.dev>',
      to,
      subject,
      html
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Email sent to ${to}:`, data.id);
    return { success: true, messageId: data.id };

  } catch (err) {
    console.error('❌ Email error:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================
// 1. BOOKING CONFIRMATION
// ============================================
async function sendBookingConfirmation(to, customerName, appointment, services) {
  const servicesHTML = services.map(s => `
    <div class="info-row">
      💅 <strong>${s.serviceName}</strong>
      <span>₱${s.price} • ${s.duration} mins</span>
    </div>
  `).join('');

  const html = emailTemplate(
    `Hello ${customerName}! 🎉`,
    `
      <p>Your appointment has been <strong style="color: #28a745;">successfully booked</strong>!</p>
      <div class="info-box">
        <div class="info-row">📅 <strong>Date</strong> ${appointment.appointmentDate}</div>
        <div class="info-row">⏰ <strong>Time</strong> ${appointment.appointmentTime}</div>
        <div class="info-row">💰 <strong>Total</strong> ₱${appointment.totalAmount.toFixed(2)}</div>
        <div class="info-row">📊 <strong>Status</strong> ${appointment.status}</div>
        ${servicesHTML}
      </div>
      <p>Please arrive 10 minutes before your appointment.</p>
    `,
    'View My Appointments',
    `${process.env.APP_URL || 'http://localhost:3000'}/history.html`
  );

  return sendEmail(to, `✅ Booking Confirmed — ${appointment.appointmentDate}`, html);
}

// ============================================
// 2. BOOKING REMINDER
// ============================================
async function sendBookingReminder(to, customerName, appointment, services) {
  const servicesHTML = services.map(s => `• ${s.serviceName} (₱${s.price})`).join('<br>');

  const html = emailTemplate(
    `Reminder: Appointment Tomorrow! 📅`,
    `
      <p>Hi <strong>${customerName}</strong>,</p>
      <p>Reminder about your appointment <strong>tomorrow</strong>!</p>
      <div class="info-box">
        <div class="info-row">📅 <strong>Date</strong> ${appointment.appointmentDate}</div>
        <div class="info-row">⏰ <strong>Time</strong> ${appointment.appointmentTime}</div>
        <div class="info-row">💰 <strong>Total</strong> ₱${appointment.totalAmount.toFixed(2)}</div>
      </div>
      <p><strong>Services:</strong><br>${servicesHTML}</p>
      <p>See you tomorrow! 💅</p>
    `,
    'View My Appointments',
    `${process.env.APP_URL || 'http://localhost:3000'}/history.html`
  );

  return sendEmail(to, `⏰ Appointment Reminder — Tomorrow at ${appointment.appointmentTime}`, html);
}

// ============================================
// 3. CANCELLATION EMAIL
// ============================================
async function sendCancellationEmail(to, customerName, appointment, reason) {
  const html = emailTemplate(
    `Appointment Cancelled ❌`,
    `
      <p>Hi <strong>${customerName}</strong>,</p>
      <p>Your appointment has been <strong style="color: #dc3545;">cancelled</strong>.</p>
      <div class="info-box">
        <div class="info-row">📅 <strong>Date</strong> ${appointment.appointmentDate}</div>
        <div class="info-row">⏰ <strong>Time</strong> ${appointment.appointmentTime}</div>
        <div class="info-row">💰 <strong>Total</strong> ₱${appointment.totalAmount.toFixed(2)}</div>
        ${reason ? `<div class="info-row">❌ <strong>Reason</strong> ${reason}</div>` : ''}
      </div>
      <p>We hope to see you soon! 💅</p>
    `,
    'Book Again',
    `${process.env.APP_URL || 'http://localhost:3000'}/calendar.html`
  );

  return sendEmail(to, `❌ Appointment Cancelled — ${appointment.appointmentDate}`, html);
}

// ============================================
// 4. PAYMENT CONFIRMATION
// ============================================
async function sendPaymentConfirmation(to, customerName, payment, appointment) {
  const html = emailTemplate(
    `Payment Received! 💰`,
    `
      <p>Hi <strong>${customerName}</strong>,</p>
      <p>We received your payment. Thank you! ✅</p>
      <div class="info-box">
        <div class="info-row">💰 <strong>Amount</strong> ₱${payment.amount.toFixed(2)}</div>
        <div class="info-row">💳 <strong>Method</strong> ${payment.paymentMethod}</div>
        <div class="info-row">🏷️ <strong>Type</strong> ${payment.paymentType}</div>
        ${payment.referenceNumber ? `<div class="info-row">🔖 <strong>Reference</strong> ${payment.referenceNumber}</div>` : ''}
      </div>
      ${appointment ? `
        <div class="info-box">
          <div class="info-row">📅 <strong>Appointment</strong> ${appointment.appointmentDate}</div>
          <div class="info-row">⚠️ <strong>Remaining Balance</strong> ₱${appointment.remainingBalance.toFixed(2)}</div>
        </div>
      ` : ''}
      <p>Salamat! 💅</p>
    `,
    'View Payments',
    `${process.env.APP_URL || 'http://localhost:3000'}/payments.html`
  );

  return sendEmail(to, `💰 Payment Confirmed — ₱${payment.amount.toFixed(2)}`, html);
}

// ============================================
// 5. APPOINTMENT CONFIRMED (by Admin)
// ============================================
async function sendAppointmentConfirmedEmail(to, customerName, appointment) {
  const html = emailTemplate(
    `Your Appointment is Confirmed! ✅`,
    `
      <p>Hi <strong>${customerName}</strong>,</p>
      <p>Your appointment has been <strong style="color: #28a745;">confirmed</strong>!</p>
      <div class="info-box">
        <div class="info-row">📅 <strong>Date</strong> ${appointment.appointmentDate}</div>
        <div class="info-row">⏰ <strong>Time</strong> ${appointment.appointmentTime}</div>
        <div class="info-row">💰 <strong>Total</strong> ₱${appointment.totalAmount.toFixed(2)}</div>
      </div>
      <p>We look forward to seeing you! 💅</p>
    `,
    'View My Appointments',
    `${process.env.APP_URL || 'http://localhost:3000'}/history.html`
  );

  return sendEmail(to, `✅ Appointment Confirmed — ${appointment.appointmentDate}`, html);
}

// ============================================
// 6. OTP EMAIL
// ============================================
async function sendOTPEmail(to, customerName, otpCode) {
  const html = emailTemplate(
    `Verify Your Email 🔐`,
    `
      <p>Hi <strong>${customerName}</strong>,</p>
      
      <p>Salamat sa pag-register sa <strong>Erica Salon</strong>!</p>
      
      <p>Ito ang iyong <strong>6-digit verification code</strong>:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <div style="
          display: inline-block;
          background: linear-gradient(135deg, #a70d40, #c2185b);
          color: white;
          font-size: 42px;
          font-weight: 700;
          letter-spacing: 12px;
          padding: 20px 30px;
          border-radius: 12px;
          font-family: 'Courier New', monospace;
        ">${otpCode}</div>
      </div>
      
      <p style="text-align: center; color: #dc3545;">
        ⚠️ Ito ay mag-e-expire sa <strong>10 minutes</strong>.
      </p>
      
      <p style="text-align: center; font-size: 13px; color: #999;">
        Kung hindi ka nag-register, i-ignore na lang itong email.
      </p>
    `
  );

  return sendEmail(to, `🔐 Erica Salon — Verify Your Email (OTP: ${otpCode})`, html);
}

// ============================================
// 7. PASSWORD RESET EMAIL
// ============================================
async function sendPasswordResetEmail(email, name, resetToken, resetUrl) {
  const html = emailTemplate(
    `Password Reset Request 🔐`,
    `
      <p>Hi <strong>${name}</strong>,</p>
      
      <p>May nag-request na i-reset ang password ng iyong Erica Salon account. Kung ikaw ito, i-click ang button sa ibaba para mag-set ng bagong password:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="
          display: inline-block;
          padding: 16px 32px;
          background: linear-gradient(135deg, #a70d40, #c2185b);
          color: white;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
        ">Reset My Password</a>
      </div>

      <div class="info-box">
        ⏰ Ang link na ito ay mag-e-expire sa <strong>1 oras</strong>.
      </div>

      <p>Kung hindi mo ginawa ang request na ito, huwag pansinin ang email na ito. Ang iyong password ay mananatiling hindi nagbabago.</p>

      <p style="margin-top: 30px; font-size: 13px; color: #999;">
        Kung hindi gumagana ang button, i-copy ang link na ito sa browser:
      </p>
      <p style="word-break: break-all; color: #a70d40; font-size: 12px;">${resetUrl}</p>
    `,
    'Back to Login',
    `${process.env.APP_URL || 'http://localhost:3000'}/login.html`
  );

  return sendEmail(email, `🔐 Erica Salon — Password Reset Request`, html);
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendBookingReminder,
  sendCancellationEmail,
  sendPaymentConfirmation,
  sendAppointmentConfirmedEmail,
  sendOTPEmail,
  sendPasswordResetEmail
};