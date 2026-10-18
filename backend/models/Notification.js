const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['LOW_STOCK', 'REMINDER', 'PAYMENT', 'SALE', 'SYSTEM'],
      default: 'SYSTEM'
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    relatedId: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
