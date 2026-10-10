const mongoose = require('mongoose');

const staffScheduleSchema = new mongoose.Schema({
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
    type: String,   // "09:00"
    required: true
  },
  endTime: {
    type: String,   // "18:00"
    required: true
  },
  status: {
    type: String,
    enum: ['Available', 'Day Off', 'Half Day'],
    default: 'Available'
  }
}, {
  timestamps: true,
  collection: 'staffSchedules'
});

// Bawal mag-doble ang schedule ng staff sa isang araw
staffScheduleSchema.index({ staffId: 1, date: 1 }, { unique: true });
staffScheduleSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('StaffSchedule', staffScheduleSchema);