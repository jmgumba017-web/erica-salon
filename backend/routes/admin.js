const router = require('express').Router();
const { Appointment, AppointmentService, Customer, Payment, User, AppointmentHistory, Staff, Feedback } = require('../models');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const { sendAppointmentConfirmedEmail, sendCancellationEmail } = require('../utils/emailService');

// All admin routes require auth + admin role
router.use(auth);
router.use(adminOnly);

// ============================================
// GET /api/admin/stats
// Dashboard statistics
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      todayAppointments,
      totalCustomers,
      totalStaff,
      totalRevenue,
      pendingBalance
    ] = await Promise.all([
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: 'Pending' }),
      Appointment.countDocuments({ status: 'Confirmed' }),
      Appointment.countDocuments({ appointmentDate: today }),
      Customer.countDocuments(),
      User.countDocuments({ role: 'Staff', status: 'Active' }),
      Payment.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Appointment.aggregate([
        { $match: { status: { $in: ['Pending', 'Confirmed', 'In Progress'] } } },
        { $group: { _id: null, total: { $sum: '$remainingBalance' } } }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        todayAppointments,
        totalCustomers,
        totalStaff,
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingBalance: pendingBalance[0]?.total || 0
      }
    });

  } catch (err) {
    console.error('❌ Stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/admin/appointments
// Get all appointments (with filters)
// ============================================
router.get('/appointments', async (req, res) => {
  try {
    const { status, date, search } = req.query;

    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (date) {
      query.appointmentDate = date;
    }

    const appointments = await Appointment.find(query)
      .populate('customerId', 'name email contactNumber')
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .limit(200);

    const withServices = await Promise.all(
      appointments.map(async (appt) => {
        const services = await AppointmentService.find({ appointmentId: appt._id })
          .populate('serviceId', 'serviceName category price duration')
          .populate('staffId', 'name specialization');
        return { ...appt.toObject(), services };
      })
    );

    let filtered = withServices;
    if (search) {
      const s = search.toLowerCase();
      filtered = withServices.filter(a =>
        a.customerId?.name?.toLowerCase().includes(s) ||
        a.customerId?.email?.toLowerCase().includes(s)
      );
    }

    res.json({
      success: true,
      count: filtered.length,
      appointments: filtered
    });

  } catch (err) {
    console.error('❌ Get appointments error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/admin/appointments/:id/confirm
// ============================================
router.put('/appointments/:id/confirm', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.status === 'Confirmed') {
      return res.status(400).json({ success: false, message: 'Already confirmed' });
    }

    if (['Cancelled', 'Completed', 'In Progress'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm ${appointment.status.toLowerCase()} appointment`
      });
    }

    const oldStatus = appointment.status;
    appointment.status = 'Confirmed';
    await appointment.save();

    await AppointmentHistory.create({
      appointmentId: appointment._id,
      action: 'Confirmed',
      oldStatus,
      newStatus: 'Confirmed',
      changedBy: req.user.id,
      reason: 'Confirmed by admin'
    });

    const customer = await Customer.findById(appointment.customerId);
    if (customer && customer.email) {
      sendAppointmentConfirmedEmail(customer.email, customer.name, appointment)
        .catch(err => console.error('Email error:', err.message));
    }

    res.json({
      success: true,
      message: 'Appointment confirmed!',
      appointment
    });

  } catch (err) {
    console.error('❌ Confirm error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/admin/appointments/:id/cancel
// ============================================
router.put('/appointments/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Already cancelled' });
    }

    if (appointment.status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed appointment' });
    }

    const oldStatus = appointment.status;
    appointment.status = 'Cancelled';
    appointment.cancelReason = reason || 'Cancelled by admin';
    await appointment.save();

    await AppointmentHistory.create({
      appointmentId: appointment._id,
      action: 'Cancelled',
      oldStatus,
      newStatus: 'Cancelled',
      changedBy: req.user.id,
      reason: reason || 'Cancelled by admin'
    });

    const customer = await Customer.findById(appointment.customerId);
    if (customer && customer.email) {
      sendAppointmentConfirmedEmail(customer.email, customer.name, appointment)
        .catch(err => console.error('Email error:', err.message));
    }

    res.json({
      success: true,
      message: 'Appointment cancelled',
      appointment
    });

  } catch (err) {
    console.error('❌ Cancel error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/admin/appointments/:id/verify-payment
// ============================================
router.put('/appointments/:id/verify-payment', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    appointment.paymentStatus = 'Verified';
    await appointment.save();

    await AppointmentHistory.create({
      appointmentId: appointment._id,
      action: 'Payment Verified',
      newStatus: appointment.status,
      changedBy: req.user.id,
      reason: 'Down payment verified by admin'
    });

    res.json({ success: true, message: 'Payment verified successfully', appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/admin/appointments/:id/complete
// ============================================
router.put('/appointments/:id/complete', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const oldStatus = appointment.status;
    appointment.status = 'Completed';
    await appointment.save();

    const customer = await Customer.findById(appointment.customerId);
    if (customer) {
      customer.totalVisits = (customer.totalVisits || 0) + 1;
      customer.totalSpent = (customer.totalSpent || 0) + appointment.totalAmount;
      customer.lastVisit = new Date();
      await customer.save();
    }

    await AppointmentHistory.create({
      appointmentId: appointment._id,
      action: 'Completed',
      oldStatus,
      newStatus: 'Completed',
      changedBy: req.user.id,
      reason: 'Marked complete by admin'
    });

    res.json({
      success: true,
      message: 'Appointment completed',
      appointment
    });

  } catch (err) {
    console.error('❌ Complete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/admin/feedbacks
// ============================================
router.get('/feedbacks', async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .sort({ createdAt: -1 }); 

    res.json({ success: true, feedbacks });
  } catch (err) {
    console.error('❌ Admin feedbacks error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/admin/reports
// ============================================
router.get('/reports', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;

    let dateFilter = {};
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (range === 'today') {
      dateFilter = { appointmentDate: todayStr };
    } else if (range === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      dateFilter = { appointmentDate: { $gte: weekAgo.toISOString().split('T')[0] } };
    } else if (range === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      dateFilter = { appointmentDate: { $gte: monthAgo.toISOString().split('T')[0] } };
    } else if (range === 'custom' && startDate && endDate) {
      dateFilter = { appointmentDate: { $gte: startDate, $lte: endDate } };
    }

    const appointments = await Appointment.find(dateFilter)
      .populate('customerId', 'name email');

    const completedAppointments = appointments.filter(a => a.status === 'Completed');
    const cancelledAppointments = appointments.filter(a => a.status === 'Cancelled');
    const pendingAppointments = appointments.filter(a => a.status === 'Pending');
    const confirmedAppointments = appointments.filter(a => a.status === 'Confirmed');

    const totalRevenue = completedAppointments.reduce((sum, a) => sum + a.totalAmount, 0);
    const totalPaid = completedAppointments.reduce((sum, a) => sum + (a.totalAmount - a.remainingBalance), 0);
    const pendingBalance = appointments
      .filter(a => !['Cancelled', 'Completed'].includes(a.status))
      .reduce((sum, a) => sum + a.remainingBalance, 0);

    const appointmentIds = appointments.map(a => a._id);
    const appointmentServices = await AppointmentService.find({
      appointmentId: { $in: appointmentIds }
    }).populate('serviceId', 'serviceName category price');

    const serviceStats = {};
    appointmentServices.forEach(as => {
      if (!as.serviceId) return;
      const svcName = as.serviceId.serviceName;
      if (!serviceStats[svcName]) {
        serviceStats[svcName] = {
          name: svcName,
          category: as.serviceId.category,
          count: 0,
          revenue: 0
        };
      }
      serviceStats[svcName].count += 1;
      serviceStats[svcName].revenue += as.price;
    });

    const topServices = Object.values(serviceStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const staffStats = {};
    for (const as of appointmentServices) {
      if (!as.staffId) continue;
      const staff = await Staff.findById(as.staffId);
      if (!staff) continue;

      const staffName = staff.name;
      if (!staffStats[staffName]) {
        staffStats[staffName] = {
          name: staffName,
          specialization: staff.specialization?.[0] || 'Staff',
          count: 0,
          revenue: 0
        };
      }
      staffStats[staffName].count += 1;
      staffStats[staffName].revenue += as.price;
    }

    const topStaff = Object.values(staffStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ===== 4. REVENUE TREND (DYNAMIC) =====
    const revenueTrend = [];
    const todayDate = new Date();
    
    let daysToShow = 7; 
    if (range === 'today') daysToShow = 1;
    else if (range === 'week') daysToShow = 7;
    else if (range === 'month') daysToShow = 30;
    else if (range === 'all') {
      const oldestAppt = await Appointment.findOne().sort({ appointmentDate: 1 });
      if (oldestAppt && oldestAppt.appointmentDate) {
         const diffTime = Math.abs(todayDate - new Date(oldestAppt.appointmentDate));
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         daysToShow = Math.min(diffDays || 7, 30);
      } else {
         daysToShow = 7;
      }
    }

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayAppts = completedAppointments.filter(a => a.appointmentDate === dateStr);
      const dayRevenue = dayAppts.reduce((sum, a) => sum + a.totalAmount, 0);

      let label = d.toLocaleDateString('en-PH', { weekday: 'short' });
      if (range === 'today') label = "Today";
      if (daysToShow > 10) label = `${month}/${day}`; 

      revenueTrend.push({
        date: dateStr,
        day: label,
        revenue: dayRevenue,
        appointments: dayAppts.length
      });
    }

    const categoryStats = {};
    appointmentServices.forEach(as => {
      if (!as.serviceId) return;
      const cat = as.serviceId.category;
      if (!categoryStats[cat]) {
        categoryStats[cat] = { category: cat, count: 0, revenue: 0 };
      }
      categoryStats[cat].count += 1;
      categoryStats[cat].revenue += as.price;
    });

    const categoryBreakdown = Object.values(categoryStats)
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      range: range || 'all',
      summary: {
        totalAppointments: appointments.length,
        completedAppointments: completedAppointments.length,
        cancelledAppointments: cancelledAppointments.length,
        pendingAppointments: pendingAppointments.length,
        confirmedAppointments: confirmedAppointments.length,
        totalRevenue,
        totalPaid,
        pendingBalance,
        averagePerAppointment: completedAppointments.length > 0
          ? totalRevenue / completedAppointments.length
          : 0
      },
      topServices,
      topStaff,
      revenueTrend,
      categoryBreakdown
    });

  } catch (err) {
    console.error('❌ Reports error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// PUT /api/admin/appointments/:id/services/:serviceId/assign
// Assign a new staff to an appointment service
// ============================================
router.put('/appointments/:appointmentId/services/:serviceId/assign', async (req, res) => {
    try {
        const { staffId } = req.body;
        const { serviceId } = req.params;

        const appointmentService = await AppointmentService.findById(serviceId);
        if (!appointmentService) {
            return res.status(404).json({ success: false, message: 'Appointment service not found' });
        }

        appointmentService.staffId = staffId;
        await appointmentService.save();

        res.json({ 
            success: true, 
            message: 'Staff assigned successfully!',
            appointmentService
        });

    } catch (err) {
        console.error('Assign staff error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;