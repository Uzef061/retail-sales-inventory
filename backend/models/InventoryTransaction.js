const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    clientUuid: {
      type: String,
      sparse: true,
      index: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    type: {
      type: String,
      enum: ['OPENING', 'PURCHASE', 'SALE', 'SALE_CANCELLED', 'ADJUSTMENT', 'RETURN', 'SALE_RETURN', 'STOCK_DEFICIT', 'DEFICIT_RECONCILED'],
      required: true
    },
    quantity: { type: Number, required: true }, // + for increase, - for decrease
    deficitQuantity: { type: Number, default: 0 },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    referenceId: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

inventoryTransactionSchema.index(
  { userId: 1, clientUuid: 1 },
  { unique: true, partialFilterExpression: { clientUuid: { $type: 'string' } } }
);

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
