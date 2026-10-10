const router = require('express').Router();
const { User, Customer } = require('../models');
const auth = require('../middleware/auth');

// ============================================
// GET /api/profile
// Get current user's profile
// ============================================
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Kunin din ang customer details
    const customer = await Customer.findOne({ userId: user._id });

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactNumber: user.contactNumber,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      customer: customer ? {
        _id: customer._id,
        notes: customer.notes,
        totalVisits: customer.totalVisits,
        totalSpent: customer.totalSpent,
        lastVisit: customer.lastVisit
      } : null
    });

  } catch (err) {
    console.error('❌ Get profile error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// PUT /api/profile
// Update current user's profile
// ============================================
router.put('/', auth, async (req, res) => {
  try {
    const { name, contactNumber, notes } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user
    if (name) user.name = name.trim();
    if (contactNumber) user.contactNumber = contactNumber.trim();

    await user.save();

    // Update customer notes (kung customer)
    if (user.role === 'Customer' && notes !== undefined) {
      await Customer.findOneAndUpdate(
        { userId: user._id },
        { notes: notes.trim() },
        { new: true }
      );
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactNumber: user.contactNumber
      }
    });

  } catch (err) {
    console.error('❌ Update profile error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// PUT /api/profile/password
// Change password
// ============================================
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all fields'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password (auto-hash via pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully!'
    });

  } catch (err) {
    console.error('❌ Change password error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;