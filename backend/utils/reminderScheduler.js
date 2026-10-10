// ============================================
// ERICA SALON — Reminder Scheduler
// ============================================
const cron = require('node-cron');
const { Appointment, AppointmentService, Customer } = require('../models');
const { sendBookingReminder } = require('./emailService');

// ============================================
// SEND DAILY REMINDERS
// ============================================
async function sendDailyReminders() {
  try {
    console.log('📧 [SCHEDULER] Sending daily appointment reminders...');

    // Compute tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`📅 [SCHEDULER] Looking for appointments on: ${tomorrowStr}`);

    // Hanapin lahat ng appointments bukas (Pending o Confirmed)
    const appointments = await Appointment.find({
      appointmentDate: tomorrowStr,
      status: { $in: ['Pending', 'Confirmed'] }
    }).populate('customerId', 'name email');

    console.log(`📊 [SCHEDULER] Found ${appointments.length} appointments`);

    let sentCount = 0;

    for (const appointment of appointments) {
      const customer = appointment.customerId;
      if (!customer || !customer.email) {
        console.log(`⚠️ [SCHEDULER] Skipping appointment ${appointment._id} — no customer email`);
        continue;
      }

      // Kunin services
      const appointmentServices = await AppointmentService.find({
        appointmentId: appointment._id
      }).populate('serviceId', 'serviceName price');

      const emailServices = appointmentServices.map(s => ({
        serviceName: s.serviceId?.serviceName || 'Service',
        price: s.price,
        duration: s.duration
      }));

      // Send reminder
      const result = await sendBookingReminder(
        customer.email,
        customer.name,
        appointment,
        emailServices
      );

      if (result.success) {
        sentCount++;
        console.log(`✅ [SCHEDULER] Reminder sent to ${customer.email}`);
      } else {
        console.log(`❌ [SCHEDULER] Failed to send to ${customer.email}: ${result.error}`);
      }
    }

    console.log(`✅ [SCHEDULER] Daily reminders complete — ${sentCount}/${appointments.length} sent`);

  } catch (err) {
    console.error('❌ [SCHEDULER] Reminder error:', err.message);
  }
}

// ============================================
// START SCHEDULER
// ============================================
function startReminderScheduler() {
  // Every day at 9:00 AM (Manila time)
  cron.schedule('0 9 * * *', () => {
    console.log('⏰ [SCHEDULER] Cron triggered at', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }));
    sendDailyReminders();
  }, {
    timezone: 'Asia/Manila'
  });

  console.log('✅ [SCHEDULER] Reminder scheduler started (daily at 9:00 AM Manila time)');
}

module.exports = {
  startReminderScheduler,
  sendDailyReminders
};