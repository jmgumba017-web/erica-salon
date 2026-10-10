const router = require('express').Router();
const { Payment, Appointment, Customer, AppointmentHistory } = require('../models');
const auth = require('../middleware/auth');
const { sendPaymentConfirmation } = require('../utils/emailService');

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ============================================
// CLOUDINARY CONFIG
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================
// MULTER SETUP (Cloudinary storage)
// ============================================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'erica-salon/receipts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [{ width: 1000, crop: 'limit' }]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ============================================
// POST /api/payments
// Create payment (down, full, or balance)
// ============================================
router.post('/', auth, upload.single('receipt'), async (req, res) => {
  try {
    const {
      appointmentId,
      amount,
      paymentMethod,
      referenceNumber,
      paymentType,
      notes
    } = req.body;

    // ===== VALIDATION =====
    if (!appointmentId || !amount || !paymentMethod || !paymentType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // ===== FIND APPOINTMENT =====
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // ===== CHECK OWNERSHIP =====
    const customer = await Customer.findOne({ userId: req.user.id });
    if (!customer || appointment.customerId.toString() !== customer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only pay for your own appointments'
      });
    }

    // ===== CHECK PAYMENT AMOUNT =====
    if (amount > appointment.remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds remaining balance (₱${appointment.remainingBalance})`
      });
    }

    // ===== CREATE PAYMENT =====
    const payment = await Payment.create({
      appointmentId: appointment._id,
      customerId: customer._id,
      amount,
      paymentMethod,
      referenceNumber: referenceNumber || '',
      paymentType,
      paymentStatus: 'Paid',
      paymentDate: new Date(),
      receivedBy: req.user.id,
      notes: notes || '',
      // ✅ Cloudinary URL (req.file.path ay full URL na)
      receiptPath: req.file ? req.file.path : ''
    });

    // ===== UPDATE APPOINTMENT BALANCE =====
    appointment.downPayment += paymentType === 'Down Payment' ? amount : 0;
    appointment.remainingBalance -= amount;

    // Auto-update status
    if (appointment.remainingBalance <= 0) {
      appointment.remainingBalance = 0;
      // Don't change status to Completed — yung staff pa rin mag-set pag tapos na service
    }

    await appointment.save();

    // ===== LOG HISTORY =====
    await AppointmentHistory.create({
      appointmentId: appointment._id,
      action: 'Payment Added',
      reason: `${paymentType}: ₱${amount} via ${paymentMethod}`,
      changedBy: req.user.id
    });

    // ===== SEND EMAIL =====
    const customerRecord = await Customer.findById(customer._id);
    const appointmentRecord = await Appointment.findById(appointmentId);

    if (customerRecord && customerRecord.email) {
      sendPaymentConfirmation(
        customerRecord.email,
        customerRecord.name,
        payment,
        appointmentRecord
      ).catch(err => console.error('Email error:', err.message));
    }

    // ===== RESPONSE =====
    res.status(201).json({
      success: true,
      message: 'Payment successful!',
      payment,
      appointment: {
        _id: appointment._id,
        totalAmount: appointment.totalAmount,
        downPayment: appointment.downPayment,
        remainingBalance: appointment.remainingBalance
      }
    });

  } catch (err) {
    console.error('❌ Payment error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// GET /api/payments/my
// Get all payments of current customer
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

    const payments = await Payment.find({ customerId: customer._id })
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate appointmentTime totalAmount status'
      })
      .sort({ paymentDate: -1 });

    res.json({
      success: true,
      count: payments.length,
      payments
    });

  } catch (err) {
    console.error('❌ Get payments error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// GET /api/payments/appointment/:appointmentId
// Get all payments for a specific appointment
// ============================================
router.get('/appointment/:appointmentId', auth, async (req, res) => {
  try {
    const payments = await Payment.find({
      appointmentId: req.params.appointmentId
    }).sort({ paymentDate: -1 });

    res.json({
      success: true,
      count: payments.length,
      payments
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/payments/:id
// Get single payment details
// ============================================
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('appointmentId', 'appointmentDate appointmentTime totalAmount')
      .populate('customerId', 'name email contactNumber');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;