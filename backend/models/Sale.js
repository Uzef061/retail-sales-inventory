const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Number, required: true, min: 0 }, // Actual transaction selling price
    costPrice: { type: Number, required: true, min: 0 },    // Transaction cost price snapshot
    totalAmount: { type: Number, required: true, min: 0 },  // Revenue
    totalCostAmount: { type: Number, required: true, min: 0 }, // Total Cost
    profit: { type: Number, required: true },               // Net Profit for this sale
    saleDate: { type: Date, default: Date.now },
    demoId: { type: String, sparse: true },                 // Idempotent demo record key
    isDemoRecord: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Virtual helper for actual selling price compatibility
saleSchema.virtual('actualSellingPrice').get(function () {
  return this.sellingPrice;
});

saleSchema.set('toJSON', { virtuals: true });
saleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sale', saleSchema);
