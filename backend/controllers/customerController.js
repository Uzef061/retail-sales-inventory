const Customer = require('../models/Customer');
const Sale = require('../models/Sale');

// GET /api/customers
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
};

// POST /api/customers
exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name || !phone || !email) {
      return res.status(400).json({ message: 'All fields (name, phone, email) are required.' });
    }
    const customer = new Customer({ name, phone, email });
    const savedCustomer = await customer.save();
    res.status(201).json(savedCustomer);
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { name, phone, email },
      { new: true, runValidators: true }
    );
    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
};

// DELETE /api/customers/:id
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCustomer = await Customer.findByIdAndDelete(id);
    if (!deletedCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.status(200).json({ message: 'Customer deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
};

// GET /api/customers/:id/sales (Purchase History)
exports.getCustomerHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const sales = await Sale.find({ customer: id })
      .populate('product', 'name price category')
      .sort({ saleDate: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer sales history', error: error.message });
  }
};
