const mongoose = require('mongoose');

const blockedScheduleSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  date: {
    type: String,   // "2026-10-10"
    required: true
  },
  startTime: {
    type: String,   // "12:00"
    required: true
  },
  endTime: {
    type: String,   // "13:00"
    required: true
  },
  reason: {
    type: String,
    enum: ['Lunch Break', 'Meeting', 'Training', 'Personal', 'Emergency', 'Other'],
    required: true
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'blockedSchedules'
});

blockedScheduleSchema.index({ staffId: 1, date: 1 });

module.exports = mongoose.model('BlockedSchedule', blockedScheduleSchema);