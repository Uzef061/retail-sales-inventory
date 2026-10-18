const Product = require('../models/Product');
const Sale = require('../models/Sale');

// GET /api/smart-inventory
exports.getSmartInventory = async (req, res) => {
  try {
    const products = await Product.find({ isActive: { $ne: false } }).sort({ stock: 1 });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch COMPLETED sales in last 30 days
    const recentSales = await Sale.find({
      saleDate: { $gte: thirtyDaysAgo },
      status: { $ne: 'CANCELLED' }
    });

    const summary = { urgent: 0, reorder: 0, monitor: 0, healthy: 0 };

    const analytics = products.map((prod) => {
      // Calculate total quantity sold in last 30 days for single-item or multi-item sales
      let qtySold = 0;
      recentSales.forEach((s) => {
        if (Array.isArray(s.items) && s.items.length > 0) {
          s.items.forEach((item) => {
            if (item.product && item.product.toString() === prod._id.toString()) {
              qtySold += item.quantity || 0;
            }
          });
        } else if (s.product && s.product.toString() === prod._id.toString()) {
          qtySold += s.quantity || 0;
        }
      });

      const avgDailySales = parseFloat((qtySold / 30).toFixed(2));
      let daysRemaining = null;
      let status = 'HEALTHY';

      if (prod.stock === 0) {
        status = 'URGENT';
        daysRemaining = 0;
      } else if (avgDailySales > 0) {
        daysRemaining = Math.round(prod.stock / avgDailySales);
        if (daysRemaining <= 3) {
          status = 'URGENT';
        } else if (daysRemaining <= 7 || prod.stock <= (prod.reorderLevel || 10)) {
          status = 'REORDER';
        } else if (daysRemaining <= 14) {
          status = 'MONITOR';
        } else {
          status = 'HEALTHY';
        }
      } else if (prod.stock <= (prod.reorderLevel || 10)) {
        status = 'REORDER';
      }

      const suggestedReorderQty = prod.reorderQuantity || Math.max(20, (prod.reorderLevel || 10) * 2 - prod.stock);

      if (status === 'URGENT') summary.urgent++;
      else if (status === 'REORDER') summary.reorder++;
      else if (status === 'MONITOR') summary.monitor++;
      else summary.healthy++;

      return {
        _id: prod._id,
        name: prod.name,
        category: prod.category,
        costPrice: prod.costPrice,
        sellingPrice: prod.sellingPrice || prod.price,
        stock: prod.stock,
        reorderLevel: prod.reorderLevel || 10,
        suggestedReorderQty,
        totalQtySold30Days: qtySold,
        avgDailySales,
        daysRemaining: daysRemaining !== null ? daysRemaining : 999,
        status,
        recommendation: status
      };
    });

    res.status(200).json({ analytics, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching smart inventory analytics', error: error.message });
  }
};
