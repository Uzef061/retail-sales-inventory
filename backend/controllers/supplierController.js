const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');

// GET /api/suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const { search, activeOnly } = req.query;
    let query = {};
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    const suppliers = await Supplier.find(query).sort({ createdAt: -1 });
    res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching suppliers', error: error.message });
  }
};

// POST /api/suppliers
exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, contactPerson } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const supplier = new Supplier({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      address: address ? address.trim() : '',
      contactPerson: contactPerson ? contactPerson.trim() : '',
      isActive: true
    });

    const savedSupplier = await supplier.save();
    res.status(201).json(savedSupplier);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating supplier', error: error.message });
  }
};

// PUT /api/suppliers/:id
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, contactPerson, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : '',
        address: address ? address.trim() : '',
        contactPerson: contactPerson ? contactPerson.trim() : '',
        isActive: isActive !== undefined ? Boolean(isActive) : true
      },
      { new: true, runValidators: true }
    );

    if (!updatedSupplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.status(200).json(updatedSupplier);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating supplier', error: error.message });
  }
};

// DELETE /api/suppliers/:id (Soft Delete if purchases exist)
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const hasPurchases = await Purchase.exists({ supplier: id });
    if (hasPurchases) {
      supplier.isActive = false;
      await supplier.save();
      return res.status(200).json({
        success: true,
        message: 'Supplier deactivated (soft-deleted) to protect historical purchase order history.',
        id
      });
    }

    await Supplier.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Supplier deleted successfully', id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting supplier', error: error.message });
  }
};
