const InventoryTransaction = require('../models/InventoryTransaction');
const { getTenantQuery } = require('../utils/tenantHelper');

// GET /api/inventory/ledger
exports.getInventoryLedger = async (req, res) => {
  try {
    const { product, type, startDate, endDate } = req.query;
    let query = getTenantQuery(req);

    if (product) {
      query.product = product;
    }
    if (type) {
      query.type = type;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = eDate;
      }
    }

    const transactions = await InventoryTransaction.find(query)
      .populate('product', 'name category stock costPrice sellingPrice')
      .populate('createdById', 'name username')
      .sort({ createdAt: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching inventory ledger', error: error.message });
  }
};
