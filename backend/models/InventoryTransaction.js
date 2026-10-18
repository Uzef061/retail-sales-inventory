const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    type: {
      type: String,
      enum: ['OPENING', 'PURCHASE', 'SALE', 'SALE_CANCELLED', 'ADJUSTMENT', 'RETURN'],
      required: true
    },
    quantity: { type: Number, required: true }, // + for increase, - for decrease
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    referenceId: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
