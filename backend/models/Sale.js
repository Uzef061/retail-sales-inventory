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
    sellingPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 }, // Revenue
    totalCostAmount: { type: Number, required: true, min: 0 }, // Total Cost
    profit: { type: Number, required: true }, // Net Profit for this sale
    saleDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', saleSchema);
