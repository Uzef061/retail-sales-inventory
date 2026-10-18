const Customer = require('../models/Customer');
const Sale = require('../models/Sale');

// Email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/customers
exports.getCustomers = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    let query = {};
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    const customers = await Customer.find(query).sort({ createdAt: -1 });
    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching customers', error: error.message });
  }
};

// POST /api/customers
exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.', errorCode: 'MISSING_NAME' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.', errorCode: 'MISSING_PHONE' });
    }
    if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.', errorCode: 'INVALID_EMAIL' });
    }

    const customer = new Customer({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      address: address ? address.trim() : '',
      isActive: true
    });

    const savedCustomer = await customer.save();
    res.status(201).json(savedCustomer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating customer', error: error.message });
  }
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : '',
        address: address ? address.trim() : '',
        isActive: isActive !== undefined ? Boolean(isActive) : true
      },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating customer', error: error.message });
  }
};

// DELETE /api/customers/:id (Soft Delete for Historical Data Protection)
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Check if customer is referenced in Sales
    const hasSales = await Sale.exists({ customer: id });

    if (hasSales) {
      customer.isActive = false;
      await customer.save();
      return res.status(200).json({
        success: true,
        message: 'Customer deactivated (soft-deleted) to protect historical purchase order history.',
        id,
        isSoftDeleted: true
      });
    }

    await Customer.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Customer deleted successfully', id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting customer', error: error.message });
  }
};

// GET /api/customers/:id/sales (Purchase Order History)
exports.getCustomerHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const sales = await Sale.find({ customer: id })
      .populate('product', 'name price sellingPrice category')
      .populate('items.product', 'name price sellingPrice category')
      .sort({ saleDate: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching customer sales history', error: error.message });
  }
};
