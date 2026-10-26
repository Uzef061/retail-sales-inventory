const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: { type: Number, required: true, min: 1 },
  sellingPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  totalCostAmount: { type: Number, required: true, min: 0 },
  profit: { type: Number, required: true },
  fulfillmentStatus: {
    type: String,
    enum: ['FULFILLED', 'STOCK_DEFICIT'],
    default: 'FULFILLED'
  },
  fulfilledQuantity: { type: Number, default: 0 },
  deficitQuantity: { type: Number, default: 0 }
});

const saleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    clientUuid: { type: String, sparse: true, index: true },
    invoiceNumber: { type: String, unique: true, sparse: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    // Single product fallback for legacy / single-item API calls
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    items: [saleItemSchema],
    quantity: { type: Number, required: true, min: 0, default: 1 },
    sellingPrice: { type: Number, required: true, min: 0, default: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    totalCostAmount: { type: Number, required: true, min: 0, default: 0 },
    profit: { type: Number, required: true, default: 0 },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'OTHER'],
      default: 'CASH'
    },
    amountReceived: { type: Number, default: 0 },
    changeDue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['COMPLETED', 'CANCELLED', 'RETURNED', 'PARTIALLY_RETURNED'],
      default: 'COMPLETED'
    },
    returnedAmount: { type: Number, default: 0 },
    fulfillmentStatus: {
      type: String,
      enum: ['FULFILLED', 'STOCK_DEFICIT'],
      default: 'FULFILLED',
      index: true
    },
    reconciliationRequired: { type: Boolean, default: false, index: true },
    reconciledAt: { type: Date },
    reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reconciliationNotes: { type: String, trim: true, default: '' },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String },
    saleDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, sparse: true, index: true },
    demoId: { type: String, sparse: true },
    isDemoRecord: { type: Boolean, default: false }
  },
  { timestamps: true }
);

saleSchema.index(
  { userId: 1, clientUuid: 1 },
  { unique: true, partialFilterExpression: { clientUuid: { $type: 'string' } } }
);
saleSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
saleSchema.index({ userId: 1, reconciliationRequired: 1 });

// Virtual helper for actual selling price compatibility
saleSchema.virtual('actualSellingPrice').get(function () {
  return this.sellingPrice;
});

saleSchema.set('toJSON', { virtuals: true });
saleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sale', saleSchema);
