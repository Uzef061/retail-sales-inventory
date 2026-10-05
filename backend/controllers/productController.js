const Product = require('../models/Product');

// GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ]
      };
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};

// POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const { name, category, costPrice, sellingPrice, price, stock } = req.body;
    if (!name || !category || stock === undefined) {
      return res.status(400).json({ message: 'Name, category, and stock are required.' });
    }

    const finalSellingPrice = sellingPrice !== undefined ? Number(sellingPrice) : Number(price || 0);
    const finalCostPrice = costPrice !== undefined ? Number(costPrice) : Math.round(finalSellingPrice * 0.7);

    const product = new Product({
      name,
      category,
      costPrice: finalCostPrice,
      sellingPrice: finalSellingPrice,
      price: finalSellingPrice,
      stock: Number(stock)
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, costPrice, sellingPrice, price, stock } = req.body;

    const finalSellingPrice = sellingPrice !== undefined ? Number(sellingPrice) : Number(price || 0);
    const finalCostPrice = costPrice !== undefined ? Number(costPrice) : Math.round(finalSellingPrice * 0.7);

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        category,
        costPrice: finalCostPrice,
        sellingPrice: finalSellingPrice,
        price: finalSellingPrice,
        stock: Number(stock)
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
};

// POST /api/products/bulk-delete
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of product IDs to delete.' });
    }

    const result = await Product.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: 'Products deleted successfully', count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error performing bulk product deletion', error: error.message });
  }
};
