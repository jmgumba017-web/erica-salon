const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'GCash', 'Maya', 'Card', 'Bank Transfer'],
    required: true
  },
  referenceNumber: {
    type: String,
    default: ''
  },
  paymentType: {
    type: String,
    enum: ['Down Payment', 'Full Payment', 'Balance'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Paid'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  // ✅ Bagong field para sa receipt
  receiptPath: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'payments'
});



paymentSchema.index({ appointmentId: 1 });
paymentSchema.index({ customerId: 1, paymentDate: -1 });
paymentSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);