const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { getPeriodDetails, buildChartBreakdown } = require('../utils/periodUtils');

// GET /api/dashboard?mode=week|month|year&refDate=2026-10-06
exports.getDashboardData = async (req, res) => {
  try {
    const mode = req.query.mode || req.query.period || 'week';
    const refDate = req.query.refDate || req.query.date;

    const periodInfo = getPeriodDetails(mode, refDate);
    const { matchQuery, label, startDate, endDate } = periodInfo;

    // 1. Total Products
    const totalProducts = await Product.countDocuments();

    // 2. Total Stock
    const stockAggregation = await Product.aggregate([
      { $group: { _id: null, totalStock: { $sum: '$stock' } } }
    ]);
    const totalStock = stockAggregation.length > 0 ? stockAggregation[0].totalStock : 0;

    // 3. Today's Sales
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaysSalesAggregation = await Sale.aggregate([
      { $match: { saleDate: { $gte: startOfToday } } },
      { $group: { _id: null, todayTotal: { $sum: '$totalAmount' } } }
    ]);
    const todaysSales = todaysSalesAggregation.length > 0 ? todaysSalesAggregation[0].todayTotal : 0;

    // 4. Low Stock Products
    const lowStockProducts = await Product.find({ stock: { $lte: 10 } }).sort({ stock: 1 });
    const lowStockCount = lowStockProducts.length;

    // 5. Financials for selected period
    const salesInPeriod = await Sale.find(matchQuery);

    const totalSalesAmount = salesInPeriod.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalCostAmount = salesInPeriod.reduce((sum, s) => sum + (s.totalCostAmount || 0), 0);
    const netProfit = salesInPeriod.reduce((sum, s) => sum + (s.profit !== undefined ? s.profit : (s.totalAmount - s.totalCostAmount)), 0);

    // 6. Recent Sales (Top 5 overall)
    const recentSales = await Sale.find()
      .populate('customer', 'name email')
      .populate('product', 'name price sellingPrice costPrice')
      .sort({ saleDate: -1 })
      .limit(5);

    // 7. Sales Chart Breakdown for selected period
    const salesChart = buildChartBreakdown(periodInfo.mode, startDate, endDate, salesInPeriod);

    res.status(200).json({
      mode: periodInfo.mode,
      refDate: periodInfo.refDate.toISOString(),
      label,
      startDate,
      endDate,
      totalProducts,
      totalStock,
      todaysSales,
      lowStockCount,
      totalSalesAmount,
      totalCostAmount,
      netProfit,
      recentSales,
      lowStockProducts,
      salesChart
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
};
