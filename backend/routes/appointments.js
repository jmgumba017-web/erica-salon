const router = require('express').Router();
const { Appointment, AppointmentService, Customer, Staff, Service, AppointmentHistory } = require('../models');
const auth = require('../middleware/auth');
const { sendBookingConfirmation } = require('../utils/emailService');

const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ============================================
// HELPER: Compute end time
// ============================================
function computeEndTime(startTime, totalDurationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + totalDurationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}


// ============================================
// GET /api/appointments/booked-times/:date
// Get booked time slots for a specific date
// ============================================
router.get('/booked-times/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // Hanapin lahat ng appointments sa date na 'to
    // na hindi Cancelled
    const appointments = await Appointment.find({
      appointmentDate: date,
      status: { $ne: 'Cancelled' }
    }).select('appointmentTime');

    const bookedTimes = appointments.map(a => a.appointmentTime);

    res.json({
      success: true,
      date,
      bookedTimes,
      totalBooked: bookedTimes.length
    });

  } catch (err) {
    console.error('❌ Get booked times error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});
// ============================================
// HELPER: Count appointments for a day
// ============================================
async function countAppointmentsInDay(appointmentDate) {
  const count = await Appointment.countDocuments({
    appointmentDate,
    status: { $in: ['Pending', 'Confirmed', 'In Progress'] }
  });
  return count;
}

// ============================================
// HELPER: Max appointments per day
// ============================================
const MAX_DAILY_CAPACITY = 6;

// ============================================
// GET /api/appointments/day-status/:date
// Get remaining slots for a specific date
// ============================================
router.get('/day-status/:date', async (req, res) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const booked = await countAppointmentsInDay(date);
    const available = Math.max(0, MAX_DAILY_CAPACITY - booked);
    const isFull = booked >= MAX_DAILY_CAPACITY;

    res.json({
      success: true,
      date,
      booked,
      available,
      maxCapacity: MAX_DAILY_CAPACITY,
      isFull
    });

  } catch (err) {
    console.error('❌ Day status error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// POST /api/appointments
// Create new appointment
// ============================================
router.post('/', auth, async (req, res) => {
  try {
    const {
      appointmentDate,
      appointmentTime,
      services,        // Array: [{ serviceId, staffId }]
      notes
    } = req.body;

    // ===== BASIC VALIDATION MUNA =====
    if (!appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'Date and time are required'
      });
    }

    if (!services || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service is required'
      });
    }

    // ===== CHECK DAILY CAPACITY (MAX 6) =====
    const dailyCount = await countAppointmentsInDay(appointmentDate);

    if (dailyCount >= MAX_DAILY_CAPACITY) {
      return res.status(400).json({
        success: false,
        message: `This date is fully booked (${MAX_DAILY_CAPACITY}/${MAX_DAILY_CAPACITY}). Please choose another date.`
      });
    }

    // ===== HANAPIN ANG CUSTOMER =====
    const customer = await Customer.findOne({ userId: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    // ===== CHECK KUNG FIRST-TIME CUSTOMER =====
    const previousCompleted = await Appointment.findOne({
      customerId: customer._id,
      status: 'Completed'
    });

    const isFirstTime = !previousCompleted;
    console.log(`👤 Customer: ${customer.name} | First-time: ${isFirstTime}`);

    // ===== KUNIN ANG DETAILS NG LAHAT NG SERVICES =====
    const serviceDetails = [];
    const emailServices = [];   // Para sa email
    let totalAmount = 0;
    let totalDuration = 0;

    for (const item of services) {
      const service = await Service.findById(item.serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: `Service not found: ${item.serviceId}`
        });
      }

      const staff = await Staff.findById(item.staffId);
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: `Staff not found: ${item.staffId}`
        });
      }

      serviceDetails.push({
        serviceId: service._id,
        staffId: staff._id,
        price: service.price,
        duration: service.duration
      });

      // Snapshot para sa email
      emailServices.push({
        serviceName: service.serviceName,
        price: service.price,
        duration: service.duration
      });

      totalAmount += service.price;
      totalDuration += service.duration;
    }

    // ===== CHECK CONFLICT SA BAWAT STAFF =====
    for (const detail of serviceDetails) {
      const conflictingAppointmentIds = await AppointmentService.find({ 
        staffId: detail.staffId 
      }).distinct('appointmentId');

      const conflict = await Appointment.findOne({
        _id: { $in: conflictingAppointmentIds },
        appointmentDate,
        appointmentTime,
        status: { $in: ['Pending', 'Confirmed', 'In Progress'] }
      });

      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `Staff is not available at this time`
        });
      }
    }

    // ===== COMPUTE END TIME =====
    const endTime = computeEndTime(appointmentTime, totalDuration);

    // ===== CREATE APPOINTMENT =====
    const appointment = await Appointment.create({
      customerId: customer._id,
      appointmentDate,
      appointmentTime,
      endTime,
      status: 'Pending',
      totalAmount,
      downPayment: 0,
      remainingBalance: totalAmount,
      notes: notes || '',
      // ✅ BAGONG FIELDS PARA SA DOWN PAYMENT
      isFirstTime: isFirstTime,
      requireDownPayment: isFirstTime
    });

    // ===== CREATE APPOINTMENT SERVICES (JUNCTION) =====
    await AppointmentService.insertMany(
      serviceDetails.map(d => ({
        appointmentId: appointment._id,
        serviceId: d.serviceId,
        staffId: d.staffId,
        price: d.price,
        duration: d.duration,
        status: 'Pending'
      }))
    );

    // ===== LOG HISTORY =====
    await AppointmentHistory.create({
      appointmentId: appointment._id,
      action: 'Created',
      newStatus: 'Pending',
      changedBy: req.user.id,
      reason: isFirstTime
        ? 'Appointment created (first-time — needs down payment)'
        : 'Appointment created via web'
    });

    // ===== GET FULL APPOINTMENT DETAILS =====
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('customerId', 'name email contactNumber');

    const populatedServices = await AppointmentService.find({ appointmentId: appointment._id })
      .populate('serviceId', 'serviceName category price duration')
      .populate('staffId', 'name specialization');

    // ===== SEND EMAIL (async — hindi natin hinihintay) =====
    if (customer && customer.email) {
      sendBookingConfirmation(
        customer.email,
        customer.name,
        appointment,
        emailServices
      ).catch(err => console.error('📧 Email error:', err.message));
    }

    // ===== COMPUTE DOWN PAYMENT AMOUNT (50%) =====
    const downPaymentAmount = isFirstTime ? totalAmount * 0.5 : 0;

    // ===== RESPONSE =====
    res.status(201).json({
      success: true,
      message: isFirstTime
        ? `Appointment booked! Please pay 50% down payment (₱${downPaymentAmount.toFixed(2)}) to confirm.`
        : 'Appointment booked successfully!',
      appointment: populatedAppointment,
      services: populatedServices,
      requireDownPayment: isFirstTime,        // ✅ Flag sa frontend
      downPaymentAmount: downPaymentAmount    // ✅ 50% amount
    });

  } catch (err) {
    console.error('❌ Create appointment error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// GET /api/appointments/my
// Get all appointments of current customer
// ============================================
router.get('/my', auth, async (req, res) => {
  try {
    const customer = await Customer.findOne({ userId: req.user.id });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

        const appointments = await Appointment.find({ customerId: customer._id })
      .sort({ createdAt: -1 }); 

    const appointmentsWithServices = await Promise.all(
      appointments.map(async (appt) => {
        const services = await AppointmentService.find({ appointmentId: appt._id })
          .populate('serviceId', 'serviceName category price duration')
          .populate('staffId', 'name specialization');

        return {
          ...appt.toObject(),
          services
        };
      })
    );

    res.json({
      success: true,
      count: appointmentsWithServices.length,
      appointments: appointmentsWithServices
    });

  } catch (err) {
    console.error('❌ Get appointments error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// GET /api/appointments/:id
// Get single appointment details
// ============================================
router.get('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('customerId', 'name email contactNumber');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const services = await AppointmentService.find({ appointmentId: appointment._id })
      .populate('serviceId', 'serviceName category price duration')
      .populate('staffId', 'name specialization');

    const history = await AppointmentHistory.find({ appointmentId: appointment._id })
      .sort({ changedAt: -1 });

    res.json({
      success: true,
      appointment,
      services,
      history
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// PUT /api/appointments/:id/cancel
// Cancel appointment (customer side)
// ============================================
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check ownership
    const customer = await Customer.findOne({ userId: req.user.id });
    if (!customer || appointment.customerId.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own appointments'
      });
    }

    if (appointment.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled'
      });
    }

    if (appointment.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed appointments cannot be cancelled'
      });
    }

    if (appointment.status === 'In Progress') {
      return res.status(400).json({
        success: false,
        message: 'In-progress appointments cannot be cancelled. Please contact the salon.'
      });
    }

    const oldStatus = appointment.status;
    appointment.status = 'Cancelled';
    appointment.cancelReason = reason || 'Cancelled by customer';
    await appointment.save();

    await AppointmentHistory.create({
      appointmentId: appointment._id,
      action: 'Cancelled',
      oldStatus,
      newStatus: 'Cancelled',
      reason: reason || 'Cancelled by customer',
      changedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment
    });

  } catch (err) {
    console.error('❌ Cancel error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// POST /api/appointments/:id/upload-receipt
// Customer: Mag-upload ng GCash receipt
// ============================================
router.post('/:id/upload-receipt', auth, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // 1. I-upload sa Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'erica_salon_receipts' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // 2. I-save ang link sa Appointment
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { 
        proofOfPayment: result.secure_url,
        paymentStatus: 'Pending Verification'
      },
      { new: true }
    );

    res.json({ success: true, message: 'Receipt uploaded successfully', appointment });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;