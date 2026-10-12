const router = require('express').Router();
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');

// ============================================
// POST /api/feedback
// Submit new feedback (public — hindi kailangan ng login)
// ============================================
router.post('/', async (req, res) => {
  try {
    const { name, email, rating, category, message } = req.body;

    // Validation
    if (!name || !rating || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, rating, at message ay required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message is too long (max 1000 characters)'
      });
    }

    const feedback = await Feedback.create({
      name,
      email: email || '',
      rating,
      category: category || 'Other',
      message
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! 💖',
      feedback
    });

  } catch (err) {
    console.error('❌ Feedback error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// ============================================
// GET /api/feedback
// Get all published feedback (public)
// ============================================
router.get('/', async (req, res) => {
  try {
    const { limit = 20, rating } = req.query;

    const filter = { status: 'Published' };
    if (rating) filter.rating = parseInt(rating);

    const feedbacks = await Feedback.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Compute average rating
    const allFeedback = await Feedback.find({ status: 'Published' });
    const avgRating = allFeedback.length > 0
      ? (allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      count: feedbacks.length,
      averageRating: parseFloat(avgRating),
      totalFeedback: allFeedback.length,
      feedbacks
    });

  } catch (err) {
    console.error('❌ Get feedback error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// GET /api/feedback/my
// Get current customer's feedback (requires login)
// ============================================
router.get('/my', auth, async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ customerId: req.user.id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: feedbacks.length,
      feedbacks
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ============================================
// DELETE /api/feedback/:id
// Delete feedback (admin only)
// ============================================
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    await Feedback.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Feedback deleted'
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;