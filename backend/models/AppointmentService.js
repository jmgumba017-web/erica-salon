const mongoose = require('mongoose');

const appointmentServiceSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  // Snapshot ng price at duration
  price: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'appointmentServices'
});

// Index para mabilis hanapin lahat ng services ng isang appointment
appointmentServiceSchema.index({ appointmentId: 1 });
appointmentServiceSchema.index({ staffId: 1, status: 1 });

module.exports = mongoose.model('AppointmentService', appointmentServiceSchema);