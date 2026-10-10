const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  appointmentDate: {
    type: String,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Show'],
    default: 'Pending'
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  downPayment: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  // ✅ BAGONG FIELDS
  requireDownPayment: {
    type: Boolean,
    default: false
  },
  isFirstTime: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  },
  cancelReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'appointments'
});

appointmentSchema.index({ customerId: 1, appointmentDate: -1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);