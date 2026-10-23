const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

// Email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/customers
exports.getCustomers = async (req, res) => {
  try {
    const { activeOnly, search } = req.query;
    let query = getTenantQuery(req);

    if (activeOnly === 'true') {
      query.isActive = true;
    }
    if (search) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      ];
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

    // Check for existing customer by phone within tenant to prevent duplicates
    const existing = await Customer.findOne({
      userId: req.user?._id,
      phone: phone.trim()
    });
    if (existing) {
      if (existing.isActive === false) {
        existing.isActive = true;
        await existing.save();
      }
      return res.status(200).json(existing);
    }

    const customer = new Customer({
      userId: req.user?._id,
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
    const customer = await Customer.findById(id);
    if (!customer || !hasTenantAccess(customer, req)) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

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

    customer.name = name.trim();
    customer.phone = phone.trim();
    customer.email = email ? email.trim() : '';
    customer.address = address ? address.trim() : '';
    if (isActive !== undefined) customer.isActive = Boolean(isActive);

    const updatedCustomer = await customer.save();
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
    if (!customer || !hasTenantAccess(customer, req)) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Check if customer is referenced in Sales, Payments, or Returns
    const hasSales = await Sale.exists({ customer: id });
    const hasPayments = await PaymentTransaction.exists({ partyId: id });
    const hasReturns = await SaleReturn.exists({ customer: id });

    if (hasSales || hasPayments || hasReturns) {
      customer.isActive = false;
      await customer.save();
      return res.status(200).json({
        success: true,
        message: 'Customer deactivated (soft-deleted) to protect historical transaction history.',
        id,
        isSoftDeleted: true
      });
    }

    await Customer.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Customer deleted successfully', id, isSoftDeleted: false });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting customer', error: error.message });
  }
};

// GET /api/customers/:id/sales (Purchase Order History)
exports.getCustomerHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer || !hasTenantAccess(customer, req)) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const sales = await Sale.find({ customer: id })
      .populate('product', 'name price sellingPrice category')
      .populate('items.product', 'name price sellingPrice category')
      .sort({ saleDate: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching customer sales history', error: error.message });
  }
};
