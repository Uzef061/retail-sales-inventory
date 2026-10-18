const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: false
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    purchaseDate: { type: Date, default: Date.now },
    referenceNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Purchase', purchaseSchema);
