const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: { type: Number, required: true, min: 1 },
  costPrice: { type: Number, required: true, min: 0 },
  unitCostPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  totalCost: { type: Number, required: true, min: 0 }
});

const purchaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    clientUuid: { type: String, sparse: true, index: true },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: false,
      index: true
    },
    // Single product fallback for legacy / single-item purchases
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    items: [purchaseItemSchema],
    quantity: { type: Number, default: 1 },
    costPrice: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PARTIALLY_PAID', 'UNPAID'],
      default: 'UNPAID'
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CREDIT', 'OTHER'],
      default: 'CASH'
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'CANCELLED', 'RETURNED', 'PARTIALLY_RETURNED'],
      default: 'COMPLETED'
    },
    returnedAmount: { type: Number, default: 0 },
    purchaseDate: { type: Date, default: Date.now },
    referenceNumber: { type: String, trim: true },
    notes: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, trim: true, index: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

purchaseSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
purchaseSchema.index(
  { userId: 1, clientUuid: 1 },
  { unique: true, partialFilterExpression: { clientUuid: { $type: 'string' } } }
);

module.exports = mongoose.model('Purchase', purchaseSchema);
