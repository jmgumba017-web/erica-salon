const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
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
  specialization: {
    type: [String],
    default: [],
    // hal. ["Hair Stylist", "Nail Technician"]
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  photo: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Available', 'On Leave', 'Inactive'],
    default: 'Available'
  }
}, {
  timestamps: true,
  collection: 'staff'
});

// Virtual para sa appointments
staffSchema.virtual('appointments', {
  ref: 'AppointmentService',
  localField: '_id',
  foreignField: 'staffId'
});

staffSchema.set('toObject', { virtuals: true });
staffSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Staff', staffSchema);
