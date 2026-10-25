const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      default: 'My Store'
    },
    ownerName: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      trim: true,
      default: 'General Retail'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    currency: {
      type: String,
      trim: true,
      default: 'INR'
    },
    taxNumber: {
      type: String,
      trim: true,
      default: ''
    },
    logoUrl: {
      type: String,
      trim: true,
      default: ''
    },
    receiptFooter: {
      type: String,
      trim: true,
      default: 'Thank you for your business!'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);
