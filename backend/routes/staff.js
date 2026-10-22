const router = require('express').Router();
const { Staff, User, Service, AppointmentService, Appointment, AppointmentHistory, Customer, StaffSchedule, BlockedSchedule } = require('../models');
const auth = require('../middleware/auth');                                                                             
const adminOnly = require('../middleware/adminOnly');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// ============================================
// CLOUDINARY CONFIG & MULTER SETUP
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ============================================
// GET /api/staff
// Get all available staff
// ============================================
router.get('/', async (req, res) => {
  try {
    const staff = await Staff.find({ status: 'Available' })
      .populate('services', 'serviceName category price');
    
    res.json({
      success: true,
      count: staff.length,
      staff
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/staff/all (Admin)
// Get ALL staff (including inactive)
// ============================================
router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const staff = await Staff.find()
      .populate('services', 'serviceName category price')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: staff.length,
      staff
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/staff/my-appointments
// ⚠️ DAPAT BAGO ANG /:id
// ============================================
router.get('/my-appointments', auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ userId: req.user.id });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff profile not found'
      });
    }

    const assignments = await AppointmentService.find({ staffId: staff._id })
      .populate({
        path: 'appointmentId',
        populate: { path: 'customerId', select: 'name email contactNumber' }
      })
      .populate('serviceId', 'serviceName category price duration')
      .sort({ createdAt: -1 });

    const validAssignments = assignments.filter(
      a => a.appointmentId && a.appointmentId.status !== 'Cancelled'
    );

    const appointmentMap = {};
    validAssignments.forEach(a => {
      const apptId = a.appointmentId._id.toString();
      if (!appointmentMap[apptId]) {
        appointmentMap[apptId] = {
          appointment: a.appointmentId,
          services: []
        };
      }
      appointmentMap[apptId].services.push({
        _id: a._id,
        serviceId: a.serviceId,
        price: a.price,
        duration: a.duration,
        status: a.status
      });
    });

    res.json({
      success: true,
      count: Object.keys(appointmentMap).length,
      appointments: Object.values(appointmentMap)
    });

  } catch (err) {
    console.error('❌ Get my appointments error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/staff/my-stats
// ⚠️ DAPAT BAGO ANG /:id
// ============================================
router.get('/my-stats', auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ userId: req.user.id });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff profile not found'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    const assignments = await AppointmentService.find({ staffId: staff._id })
      .populate('appointmentId', 'appointmentDate status');

    const valid = assignments.filter(a => a.appointmentId);

    const totalAssigned = new Set(valid.map(a => a.appointmentId._id.toString())).size;
    const todayAssigned = new Set(
      valid
        .filter(a => a.appointmentId.appointmentDate === today)
        .map(a => a.appointmentId._id.toString())
    ).size;
    const completed = new Set(
      valid
        .filter(a => a.appointmentId.status === 'Completed')
        .map(a => a.appointmentId._id.toString())
    ).size;
    const pending = new Set(
      valid
        .filter(a => ['Pending', 'Confirmed'].includes(a.appointmentId.status))
        .map(a => a.appointmentId._id.toString())
    ).size;

    res.json({
      success: true,
      stats: {
        totalAssigned,
        todayAssigned,
        completed,
        pending
      }
    });

  } catch (err) {
    console.error('❌ Stats error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/staff/my-schedules
// ✅ INILIPAT DITO PARA HINDI MAG-CONFLICT SA /:id
// ============================================
router.get('/my-schedules', auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ userId: req.user.id });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    const schedules = await StaffSchedule.find({ staffId: staff._id }).sort({ date: 1 });
    const blocked = await BlockedSchedule.find({ staffId: staff._id }).sort({ date: 1 });

    res.json({
      success: true,
      schedules,
      blocked
    });
  } catch (err) {
    console.error('❌ Get my schedules error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/staff/appointments/:id/complete
// ⚠️ DAPAT BAGO ANG /:id
// ============================================
router.put('/appointments/:id/complete', auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ userId: req.user.id });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const assignment = await AppointmentService.findById(req.params.id);
    if (!assignment || assignment.staffId.toString() !== staff._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this assignment'
      });
    }

    assignment.status = 'Completed';
    await assignment.save();

    const allServices = await AppointmentService.find({ appointmentId: assignment.appointmentId });
    const allCompleted = allServices.every(s => s.status === 'Completed');

    if (allCompleted) {
      const appointment = await Appointment.findById(assignment.appointmentId);
      if (appointment) {
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
          reason: 'All services completed by staff'
        });
      }
    }

    res.json({
      success: true,
      message: 'Service marked as completed!'
    });

  } catch (err) {
    console.error('❌ Complete assignment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// POST /api/staff (Admin)
// ✅ MAY PHOTO UPLOAD NA VIA CLOUDINARY
// ============================================
router.post('/', auth, adminOnly, upload.single('photo'), async (req, res) => {
  try {
    const {
      name, email, password, contactNumber,
      specialization, services, bio, status
    } = req.body;
    
    console.log('📥 Received Data:', req.body);

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    let photoUrl = 'image/erica.jpg'; 
    
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'erica_salon_staff' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      photoUrl = result.secure_url;
    }

    let parsedSpecialization = [];
    let parsedServices = [];
    try {
      if (specialization) parsedSpecialization = JSON.parse(specialization);
      if (services) parsedServices = JSON.parse(services);
    } catch (e) {
      parsedSpecialization = specialization ? [specialization] : [];
      parsedServices = services ? [services] : [];
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'Staff',
      contactNumber: contactNumber || '',
      status: 'Active'
    });

    const staff = await Staff.create({
      userId: user._id,
      name: user.name,
      contactNumber: user.contactNumber,
      specialization: parsedSpecialization,
      services: parsedServices,
      photo: photoUrl,
      bio: bio || '',
      status: status || 'Available'
    });

    await staff.populate('services', 'serviceName category price');

    res.status(201).json({
      success: true,
      message: 'Staff created successfully!',
      staff
    });

  } catch (err) {
    console.error('❌ Create staff error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/staff/:id (Admin)
// ✅ MAY PHOTO UPLOAD UPDATE DIN
// ============================================
router.put('/:id', auth, adminOnly, upload.single('photo'), async (req, res) => {
  try {
    const { name, contactNumber, specialization, services, bio, status } = req.body;

    const staff = await Staff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'erica_salon_staff' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      staff.photo = result.secure_url;
    }

    let parsedSpecialization = staff.specialization;
    let parsedServices = staff.services;
    try {
      if (specialization) parsedSpecialization = JSON.parse(specialization);
      if (services) parsedServices = JSON.parse(services);
    } catch (e) {
      if (specialization) parsedSpecialization = [specialization];
      if (services) parsedServices = [services];
    }

    if (name) staff.name = name.trim();
    if (contactNumber !== undefined) staff.contactNumber = contactNumber.trim();
    staff.specialization = parsedSpecialization;
    staff.services = parsedServices;
    if (bio !== undefined) staff.bio = bio;
    if (status) staff.status = status;

    await staff.save();

    const user = await User.findById(staff.userId);
    if (user) {
      if (name) user.name = name.trim();
      if (contactNumber !== undefined) user.contactNumber = contactNumber.trim();
      await user.save();
    }

    await staff.populate('services', 'serviceName category price');

    res.json({
      success: true,
      message: 'Staff updated successfully!',
      staff
    });

  } catch (err) {
    console.error('❌ Update staff error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// DELETE /api/staff/:id (Admin)
// ============================================
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    await Staff.findByIdAndDelete(req.params.id);

    if (staff.userId) {
      await User.findByIdAndDelete(staff.userId);
    }

    res.json({
      success: true,
      message: 'Staff deleted successfully!'
    });

  } catch (err) {
    console.error('❌ Delete staff error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/staff/:id
// ⚠️ DAPAT ITO ANG PINAKA-HULI
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id)
      .populate('services', 'serviceName category price duration');
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    res.json({
      success: true,
      staff
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;