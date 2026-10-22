const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null 
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  category: {
    type: String,
    default: 'Other'
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Published'],
    default: 'Published' // Agad na lumalabas sa public page
  }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);