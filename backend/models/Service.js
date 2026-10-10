const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true
  },
  category: {
    type: String,
    enum: ['Hair', 'Nails', 'Skin', 'Body', 'Makeup', 'Lashes & Brows'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  duration: {
    type: Number,
    required: true,
    min: [5, 'Duration must be at least 5 minutes']
    // in minutes
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true,
  collection: 'services'
});

// Index para mabilis mag-filter by category
serviceSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Service', serviceSchema);