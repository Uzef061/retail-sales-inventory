const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clientUuid: {
      type: String,
      sparse: true,
      index: true
    },
    type: {
      type: String,
      enum: ['RECEIVE', 'GIVE'],
      required: true,
      index: true
    },
    partyType: {
      type: String,
      enum: ['CUSTOMER', 'SUPPLIER', 'OTHER'],
      required: true
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'partyModel',
      required: false
    },
    partyModel: {
      type: String,
      enum: ['Customer', 'Supplier'],
      required: false
    },
    partyName: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than zero']
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'],
      default: 'CASH'
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

paymentTransactionSchema.index(
  { userId: 1, clientUuid: 1 },
  { unique: true, partialFilterExpression: { clientUuid: { $type: 'string' } } }
);
paymentTransactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
