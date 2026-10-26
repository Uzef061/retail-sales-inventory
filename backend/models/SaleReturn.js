const mongoose = require('mongoose');

const returnedItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  quantity: { type: Number, required: true, min: 1 },
  sellingPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  restoredToStock: { type: Boolean, default: false },
  condition: {
    type: String,
    enum: ['SELLABLE', 'DAMAGED', 'REJECTED'],
    default: 'SELLABLE'
  }
});

const saleReturnSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    clientUuid: { type: String, sparse: true, index: true },
    saleClientUuid: { type: String, sparse: true, index: true },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true
    },
    invoiceNumber: { type: String, unique: true, sparse: true },
    originalInvoiceNumber: { type: String, default: '' },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    returnDate: { type: Date, default: Date.now, index: true },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Return amount must be greater than zero']
    },
    refundMode: {
      type: String,
      enum: ['REDUCE_RECEIVABLE', 'REFUND_PAID', 'STORE_CREDIT'],
      default: 'REDUCE_RECEIVABLE'
    },
    refundAmount: { type: Number, default: 0 },
    items: [returnedItemSchema],
    reason: { type: String, trim: true, default: 'Customer return' },
    restoreStock: { type: Boolean, default: true },
    idempotencyKey: { type: String, trim: true, index: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

saleReturnSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
saleReturnSchema.index(
  { userId: 1, clientUuid: 1 },
  {
    unique: true,
    partialFilterExpression: { clientUuid: { $type: 'string' } },
    name: 'userId_1_clientUuid_1_v2'
  }
);

module.exports = mongoose.model('SaleReturn', saleReturnSchema);
