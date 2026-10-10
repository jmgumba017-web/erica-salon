const router = require('express').Router();
const { StaffSchedule, BlockedSchedule, Staff, User } = require('../models');  
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// ============================================
// GET /api/schedules/staff/:staffId
// Get all schedules for a specific staff
// ============================================
router.get('/staff/:staffId', auth, adminOnly, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = { staffId: req.params.staffId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const schedules = await StaffSchedule.find(query).sort({ date: 1 });
    const blocked = await BlockedSchedule.find(query).sort({ date: 1, startTime: 1 });

    res.json({
      success: true,
      schedules,
      blocked
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// POST /api/schedules
// Create new schedule (Admin)
// ============================================
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { staffId, date, startTime, endTime, status } = req.body;

    if (!staffId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Check duplicate
    const existing = await StaffSchedule.findOne({ staffId, date });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Schedule already exists for this date'
      });
    }

    const schedule = await StaffSchedule.create({
      staffId,
      date,
      startTime,
      endTime,
      status: status || 'Available'
    });

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      schedule
    });

  } catch (err) {
    console.error('❌ Create schedule error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// POST /api/schedules/bulk
// Create weekly schedule (Admin)
// ============================================
router.post('/bulk', auth, adminOnly, async (req, res) => {
  try {
    const { staffId, schedules } = req.body;

    if (!staffId || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID and schedules are required'
      });
    }

    const created = [];
    const skipped = [];

    for (const s of schedules) {
      const existing = await StaffSchedule.findOne({ staffId, date: s.date });
      if (existing) {
        // Update existing
        existing.startTime = s.startTime;
        existing.endTime = s.endTime;
        existing.status = s.status || 'Available';
        await existing.save();
        created.push(existing);
      } else {
        const newSchedule = await StaffSchedule.create({
          staffId,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status || 'Available'
        });
        created.push(newSchedule);
      }
    }

    res.json({
      success: true,
      message: `${created.length} schedules saved`,
      schedules: created
    });

  } catch (err) {
    console.error('❌ Bulk schedule error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/schedules/:id
// Update schedule
// ============================================
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { startTime, endTime, status } = req.body;

    const schedule = await StaffSchedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    if (status) schedule.status = status;

    await schedule.save();

    res.json({
      success: true,
      message: 'Schedule updated',
      schedule
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// DELETE /api/schedules/:id
// Delete schedule
// ============================================
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const schedule = await StaffSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    res.json({ success: true, message: 'Schedule deleted' });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// POST /api/schedules/blocked
// Create blocked schedule (Admin)
// ============================================
router.post('/blocked', auth, adminOnly, async (req, res) => {
  try {
    const { staffId, date, startTime, endTime, reason, notes } = req.body;

    if (!staffId || !date || !startTime || !endTime || !reason) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const blocked = await BlockedSchedule.create({
      staffId,
      date,
      startTime,
      endTime,
      reason,
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      message: 'Time blocked successfully',
      blocked
    });

  } catch (err) {
    console.error('❌ Block time error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// PUT /api/schedules/blocked/:id
// Update blocked schedule
// ============================================
router.put('/blocked/:id', auth, adminOnly, async (req, res) => {
  try {
    const { startTime, endTime, reason, notes } = req.body;

    const blocked = await BlockedSchedule.findById(req.params.id);
    if (!blocked) {
      return res.status(404).json({ success: false, message: 'Blocked schedule not found' });
    }

    if (startTime) blocked.startTime = startTime;
    if (endTime) blocked.endTime = endTime;
    if (reason) blocked.reason = reason;
    if (notes !== undefined) blocked.notes = notes;

    await blocked.save();

    res.json({
      success: true,
      message: 'Blocked schedule updated',
      blocked
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// DELETE /api/schedules/blocked/:id
// Delete blocked schedule
// ============================================
router.delete('/blocked/:id', auth, adminOnly, async (req, res) => {
  try {
    const blocked = await BlockedSchedule.findByIdAndDelete(req.params.id);
    if (!blocked) {
      return res.status(404).json({ success: false, message: 'Blocked schedule not found' });
    }

    res.json({ success: true, message: 'Blocked schedule deleted' });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;