const router = require('express').Router();
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');

// ============================================
// POST /api/feedback
// Submit new feedback (public)
// ============================================
router.post('/', async (req, res) => {
  try {
    const { name, email, rating, category, message } = req.body;

    if (!name || !rating || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, rating, at message ay required'
      });
    }

    const feedback = await Feedback.create({
      name,
      email: email || '',
      rating,
      category: category || 'Other',
      message,
      status: 'Published'
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! 💖',
      feedback
    });

  } catch (err) {
    console.error('❌ Feedback error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// GET /api/feedback (Public - for homepage)
// ============================================
router.get('/', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const feedbacks = await Feedback.find({ status: 'Published' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const allFeedback = await Feedback.find({ status: 'Published' });
    const avgRating = allFeedback.length > 0
      ? (allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      count: feedbacks.length,
      averageRating: parseFloat(avgRating),
      feedbacks
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;