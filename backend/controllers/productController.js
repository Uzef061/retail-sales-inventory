const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');

// GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { search, activeOnly } = req.query;
    let query = {};
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching products', error: error.message });
  }
};

// POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const { name, category, costPrice, sellingPrice, price, stock, reorderLevel, reorderQuantity, sku } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required.', errorCode: 'MISSING_NAME' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required.', errorCode: 'MISSING_CATEGORY' });
    }
    if (stock === undefined || stock === null || isNaN(Number(stock))) {
      return res.status(400).json({ success: false, message: 'Valid stock quantity is required.', errorCode: 'INVALID_STOCK' });
    }

    const stockNum = Number(stock);
    if (stockNum < 0 || !Number.isInteger(stockNum)) {
      return res.status(400).json({ success: false, message: 'Stock must be a non-negative integer.', errorCode: 'INVALID_STOCK_VAL' });
    }

    const finalSellingPrice = sellingPrice !== undefined ? Number(sellingPrice) : Number(price || 0);
    const finalCostPrice = costPrice !== undefined ? Number(costPrice) : Math.round(finalSellingPrice * 0.7);

    if (finalSellingPrice < 0 || finalCostPrice < 0) {
      return res.status(400).json({ success: false, message: 'Prices cannot be negative values.', errorCode: 'NEGATIVE_PRICE' });
    }

    // Check duplicate product name
    const existing = await Product.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
    if (existing) {
      return res.status(400).json({ success: false, message: `A product named "${name.trim()}" already exists.`, errorCode: 'DUPLICATE_NAME' });
    }

    const product = new Product({
      name: name.trim(),
      category: category.trim(),
      costPrice: finalCostPrice,
      sellingPrice: finalSellingPrice,
      price: finalSellingPrice,
      stock: stockNum,
      reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 10,
      reorderQuantity: reorderQuantity !== undefined ? Number(reorderQuantity) : 20,
      sku: sku ? sku.trim() : undefined,
      isActive: true
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating product', error: error.message });
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, costPrice, sellingPrice, price, stock, reorderLevel, reorderQuantity, sku, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      return res.status(400).json({ success: false, message: 'Stock must be a non-negative number.' });
    }

    const finalSellingPrice = sellingPrice !== undefined ? Number(sellingPrice) : Number(price || 0);
    const finalCostPrice = costPrice !== undefined ? Number(costPrice) : Math.round(finalSellingPrice * 0.7);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        category: category.trim(),
        costPrice: finalCostPrice,
        sellingPrice: finalSellingPrice,
        price: finalSellingPrice,
        stock: stockNum,
        reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 10,
        reorderQuantity: reorderQuantity !== undefined ? Number(reorderQuantity) : 20,
        sku: sku ? sku.trim() : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : true
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating product', error: error.message });
  }
};

// DELETE /api/products/:id (Protected Soft Delete for Historical Data Preservation)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if product is referenced in Sales or Purchases
    const hasSales = await Sale.exists({ $or: [{ product: id }, { 'items.product': id }] });
    const hasPurchases = await Purchase.exists({ product: id });

    if (hasSales || hasPurchases) {
      // Soft delete to protect historical financial and ledger records
      product.isActive = false;
      await product.save();
      return res.status(200).json({
        success: true,
        message: 'Product deactivated (soft-deleted) to preserve historical transaction records.',
        id,
        isSoftDeleted: true
      });
    }

    await Product.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Product deleted successfully', id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting product', error: error.message });
  }
};

// POST /api/products/bulk-delete
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of product IDs to delete.' });
    }

    for (const id of ids) {
      const hasSales = await Sale.exists({ $or: [{ product: id }, { 'items.product': id }] });
      const hasPurchases = await Purchase.exists({ product: id });
      if (hasSales || hasPurchases) {
        await Product.findByIdAndUpdate(id, { isActive: false });
      } else {
        await Product.findByIdAndDelete(id);
      }
    }

    res.status(200).json({ success: true, message: 'Products processed for deletion/deactivation successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error performing bulk product deletion', error: error.message });
  }
};
