const mongoose = require('mongoose');

const appointmentHistorySchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  action: {
    type: String,
    enum: [
      'Created',
      'Updated',
      'Confirmed',
      'Cancelled',
      'Completed',
      'Rescheduled',
      'No Show',
      'Payment Added',
      'Service Added',
      'Service Removed',
      'Status Changed'
    ],
    required: true
  },
  oldStatus: {
    type: String,
    default: ''
  },
  newStatus: {
    type: String,
    default: ''
  },
  reason: {
    type: String,
    default: ''
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'appointmentHistory'
});

appointmentHistorySchema.index({ appointmentId: 1, changedAt: -1 });
appointmentHistorySchema.index({ changedAt: -1 });

module.exports = mongoose.model('AppointmentHistory', appointmentHistorySchema);