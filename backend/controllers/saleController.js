const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

// GET /api/sales
exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate('customer', 'name email phone')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .sort({ saleDate: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales', error: error.message });
  }
};

// POST /api/sales
exports.createSale = async (req, res) => {
  try {
    const { customer, product, quantity, price, sellingPrice, costPrice } = req.body;

    if (!customer || !product || !quantity) {
      return res.status(400).json({ message: 'Customer, product, and quantity are required.' });
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than 0.' });
    }

    // Find target product
    const targetProduct = await Product.findById(product);
    if (!targetProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Check stock
    if (targetProduct.stock < qty) {
      return res.status(400).json({
        message: `Insufficient stock for ${targetProduct.name}. Available stock: ${targetProduct.stock}`
      });
    }

    // Find customer
    const targetCustomer = await Customer.findById(customer);
    if (!targetCustomer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    // Determine prices
    const unitSellingPrice = sellingPrice !== undefined
      ? Number(sellingPrice)
      : (price !== undefined ? Number(price) : (targetProduct.sellingPrice || targetProduct.price));

    const unitCostPrice = costPrice !== undefined
      ? Number(costPrice)
      : (targetProduct.costPrice || Math.round(unitSellingPrice * 0.7));

    // Calculate financials
    const totalAmount = unitSellingPrice * qty; // Revenue
    const totalCostAmount = unitCostPrice * qty; // Cost
    const profit = totalAmount - totalCostAmount; // Profit

    // Reduce product stock
    targetProduct.stock -= qty;
    await targetProduct.save();

    // Create & save sale record with financial snapshot
    const newSale = new Sale({
      customer,
      product,
      quantity: qty,
      sellingPrice: unitSellingPrice,
      costPrice: unitCostPrice,
      totalAmount,
      totalCostAmount,
      profit,
      saleDate: new Date()
    });

    const savedSale = await newSale.save();
    const populatedSale = await Sale.findById(savedSale._id)
      .populate('customer', 'name email phone')
      .populate('product', 'name price sellingPrice costPrice category stock');

    res.status(201).json(populatedSale);
  } catch (error) {
    res.status(500).json({ message: 'Error creating sale', error: error.message });
  }
};

// DELETE /api/sales/:id
exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSale = await Sale.findByIdAndDelete(id);
    if (!deletedSale) {
      return res.status(404).json({ message: 'Sale record not found.' });
    }
    res.status(200).json({ message: 'Sale deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting sale', error: error.message });
  }
};

// POST /api/sales/bulk-delete
exports.bulkDeleteSales = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of sale IDs to delete.' });
    }

    const result = await Sale.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: 'Sales deleted successfully', count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error performing bulk sale deletion', error: error.message });
  }
};
