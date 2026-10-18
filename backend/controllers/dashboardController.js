const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const { getPeriodDetails, buildChartBreakdown } = require('../utils/periodUtils');

// GET /api/dashboard?mode=week|month|year&refDate=2026-10-06
exports.getDashboardData = async (req, res) => {
  try {
    const mode = req.query.mode || req.query.period || 'week';
    const refDate = req.query.refDate || req.query.date;

    const periodInfo = getPeriodDetails(mode, refDate);
    const { matchQuery, label, startDate, endDate } = periodInfo;

    // 1. Total Active Products
    const totalProducts = await Product.countDocuments({ isActive: { $ne: false } });

    // 2. Total Stock
    const stockAggregation = await Product.aggregate([
      { $match: { isActive: { $ne: false } } },
      { $group: { _id: null, totalStock: { $sum: '$stock' } } }
    ]);
    const totalStock = stockAggregation.length > 0 ? stockAggregation[0].totalStock : 0;

    // 3. Today's Sales (Exclude Cancelled)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaysSalesAggregation = await Sale.aggregate([
      { $match: { saleDate: { $gte: startOfToday }, status: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: null,
          todayTotal: { $sum: { $ifNull: ['$totalAmount', '$grandTotal'] } },
          todayCount: { $sum: 1 }
        }
      }
    ]);
    const todaysSales = todaysSalesAggregation.length > 0 ? todaysSalesAggregation[0].todayTotal : 0;
    const todaysSalesCount = todaysSalesAggregation.length > 0 ? todaysSalesAggregation[0].todayCount : 0;

    // 4. Low Stock Products
    const lowStockProducts = await Product.find({ stock: { $lte: 10 }, isActive: { $ne: false } }).sort({ stock: 1 });
    const lowStockCount = lowStockProducts.length;

    // 5. Financials for selected period (matchQuery excludes CANCELLED)
    const salesInPeriod = await Sale.find(matchQuery);

    const totalSalesAmount = salesInPeriod.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalCostAmount = salesInPeriod.reduce((sum, s) => sum + (s.totalCostAmount || 0), 0);
    const netProfit = salesInPeriod.reduce((sum, s) => sum + (s.profit !== undefined ? s.profit : (s.totalAmount - s.totalCostAmount)), 0);

    // 6. Recent Sales (Top 5 overall)
    const recentSales = await Sale.find()
      .populate('customer', 'name email phone')
      .populate('product', 'name price sellingPrice costPrice')
      .populate('items.product', 'name price sellingPrice costPrice')
      .sort({ saleDate: -1, createdAt: -1 })
      .limit(5);

    // 7. Recent Purchases (Top 5 overall)
    const recentPurchases = await Purchase.find()
      .populate('supplier', 'name phone contactPerson')
      .populate('product', 'name category costPrice sellingPrice')
      .sort({ purchaseDate: -1, createdAt: -1 })
      .limit(5);

    // 7. Sales Chart Breakdown for selected period
    const salesChart = buildChartBreakdown(periodInfo.mode, startDate, endDate, salesInPeriod);

    // 8. Automated Business Insights (Calculated from real DB data)
    const insights = [];

    // Best-selling product
    const topProductAggregation = await Sale.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$product', totalQty: { $sum: '$quantity' }, totalRev: { $sum: '$totalAmount' } } },
      { $sort: { totalQty: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' }
    ]);

    if (topProductAggregation.length > 0) {
      const topProd = topProductAggregation[0].prod;
      insights.push({
        type: 'BEST_SELLER',
        icon: '🏆',
        message: `${topProd.name} is your top-selling product in this period (${topProductAggregation[0].totalQty} units sold).`
      });
    }

    // Low stock warning
    if (lowStockProducts.length > 0) {
      const critical = lowStockProducts[0];
      insights.push({
        type: 'STOCK_ALERT',
        icon: '⚠️',
        message: critical.stock === 0
          ? `${critical.name} is completely out of stock! Restock recommended.`
          : `${critical.name} is low on stock (${critical.stock} units remaining).`
      });
    }

    // Revenue / Profit summary
    if (totalSalesAmount > 0) {
      const margin = ((netProfit / totalSalesAmount) * 100).toFixed(1);
      insights.push({
        type: 'PROFIT_MARGIN',
        icon: '📈',
        message: `Operating at a ${margin}% net profit margin with ₹${totalSalesAmount.toLocaleString()} total revenue.`
      });
    } else {
      insights.push({
        type: 'NO_SALES',
        icon: '💡',
        message: 'No completed sales logged for the selected period yet.'
      });
    }

    res.status(200).json({
      mode: periodInfo.mode,
      refDate: periodInfo.refDate.toISOString(),
      label,
      startDate,
      endDate,
      totalProducts,
      totalStock,
      todaysSales,
      todaysSalesCount,
      lowStockCount,
      totalSalesAmount,
      totalCostAmount,
      netProfit,
      recentSales,
      recentPurchases,
      lowStockProducts,
      salesChart,
      insights
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
};
