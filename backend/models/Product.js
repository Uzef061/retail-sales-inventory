const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0, default: 0 },
    // Backwards compatibility property 'price' mapped to sellingPrice
    price: {
      type: Number,
      min: 0,
      get: function() { return this.sellingPrice; }
    },
    stock: { type: Number, required: true, min: 0, default: 0 }
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
  }
);

// Virtual property 'profitMarginPerUnit'
productSchema.virtual('profitPerUnit').get(function () {
  return this.sellingPrice - this.costPrice;
});

module.exports = mongoose.model('Product', productSchema);
