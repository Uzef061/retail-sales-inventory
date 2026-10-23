const mongoose = require('mongoose');

const returnedPurchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, required: true, min: 0 },
  unitCostPrice: { type: Number, default: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  deductedFromStock: { type: Boolean, default: true }
});

const purchaseReturnSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true,
      index: true
    },
    referenceNumber: { type: String, unique: true, sparse: true },
    originalReferenceNumber: { type: String, default: '' },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
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
      enum: ['REDUCE_PAYABLE', 'REFUND_RECEIVED', 'SUPPLIER_CREDIT'],
      default: 'REDUCE_PAYABLE'
    },
    refundAmount: { type: Number, default: 0 },
    items: [returnedPurchaseItemSchema],
    reason: { type: String, trim: true, default: 'Return to supplier' },
    deductStock: { type: Boolean, default: true },
    idempotencyKey: { type: String, trim: true, index: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

purchaseReturnSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
