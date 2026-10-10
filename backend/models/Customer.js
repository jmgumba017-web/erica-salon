const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  notes: {
    type: String,
    default: ''
  },
  totalVisits: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  lastVisit: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'customers'
});

// Virtual para kunin ang appointments
customerSchema.virtual('appointments', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'customerId'
});

customerSchema.set('toObject', { virtuals: true });
customerSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Customer', customerSchema);