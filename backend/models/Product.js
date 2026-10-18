const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0, default: 0 },
    // Backwards compatibility property 'price' mapped to sellingPrice
    price: {
      type: Number,
      min: 0,
      get: function () {
        return this.sellingPrice;
      }
    },
    stock: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    reorderQuantity: { type: Number, default: 20, min: 1 },
    sku: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
  }
);

// Virtual property 'profitPerUnit'
productSchema.virtual('profitPerUnit').get(function () {
  return (this.sellingPrice || 0) - (this.costPrice || 0);
});

module.exports = mongoose.model('Product', productSchema);
