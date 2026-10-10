const router = require('express').Router();
const { Service } = require('../models');          
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// ============================================
// GET /api/services
// Get all active services (public)
// ============================================
router.get('/', async (req, res) => {
  try {
    const services = await Service.find({ status: 'Active' })
      .sort({ category: 1, serviceName: 1 });
    
    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/services/all (Admin)
// Get ALL services (including inactive)
// ============================================
router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const services = await Service.find().sort({ category: 1, serviceName: 1 });
    
    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/services/category/:category
// ============================================
router.get('/category/:category', async (req, res) => {
  try {
    const services = await Service.find({
      category: req.params.category,
      status: 'Active'
    });
    
    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// POST /api/services (Admin)
// Create new service
// ============================================
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { serviceName, category, description, price, duration, status } = req.body;

    // Validation
    if (!serviceName || !category || !price || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be negative'
      });
    }

    if (duration < 5) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be at least 5 minutes'
      });
    }

    // Check duplicate
    const existing = await Service.findOne({
      serviceName: { $regex: new RegExp(`^${serviceName}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Service name already exists'
      });
    }

    // Create
    const service = await Service.create({
      serviceName: serviceName.trim(),
      category,
      description: description?.trim() || '',
      price: Number(price),
      duration: Number(duration),
      status: status || 'Active'
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully!',
      service
    });

  } catch (err) {
    console.error('❌ Create service error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// PUT /api/services/:id (Admin)
// Update service
// ============================================
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { serviceName, category, description, price, duration, status } = req.body;

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check duplicate (except self)
    if (serviceName && serviceName !== service.serviceName) {
      const existing = await Service.findOne({
        serviceName: { $regex: new RegExp(`^${serviceName}$`, 'i') },
        _id: { $ne: service._id }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Service name already exists'
        });
      }
    }

    // Update
    if (serviceName) service.serviceName = serviceName.trim();
    if (category) service.category = category;
    if (description !== undefined) service.description = description.trim();
    if (price !== undefined) service.price = Number(price);
    if (duration !== undefined) service.duration = Number(duration);
    if (status) service.status = status;

    await service.save();

    res.json({
      success: true,
      message: 'Service updated successfully!',
      service
    });

  } catch (err) {
    console.error('❌ Update service error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// DELETE /api/services/:id (Admin)
// Delete service
// ============================================
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await Service.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Service deleted successfully!'
    });

  } catch (err) {
    console.error('❌ Delete service error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;