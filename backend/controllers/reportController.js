const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { getPeriodDetails, buildChartBreakdown } = require('../utils/periodUtils');

// GET /api/reports?mode=week|month|year&refDate=2026-10-06
exports.getReports = async (req, res) => {
  try {
    const mode = req.query.mode || req.query.period || 'week';
    const refDate = req.query.refDate || req.query.date;

    const periodInfo = getPeriodDetails(mode, refDate);
    const { matchQuery, label, startDate, endDate } = periodInfo;

    const salesInPeriod = await Sale.find(matchQuery);

    const totalSalesAmount = salesInPeriod.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalCostAmount = salesInPeriod.reduce((sum, s) => sum + (s.totalCostAmount || 0), 0);
    const netProfit = salesInPeriod.reduce((sum, s) => sum + (s.profit !== undefined ? s.profit : (s.totalAmount - s.totalCostAmount)), 0);

    const profit = netProfit > 0 ? netProfit : 0;
    const loss = netProfit < 0 ? Math.abs(netProfit) : 0;
    const profitMargin = totalSalesAmount > 0 ? parseFloat(((netProfit / totalSalesAmount) * 100).toFixed(2)) : 0;

    const salesByDate = buildChartBreakdown(periodInfo.mode, startDate, endDate, salesInPeriod);

    // Best-selling products in period
    const bestSellingProducts = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$product',
          totalQuantitySold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $project: {
          _id: 1,
          name: '$productDetails.name',
          category: '$productDetails.category',
          price: '$productDetails.sellingPrice',
          totalQuantitySold: 1,
          totalRevenue: 1,
          totalProfit: 1
        }
      }
    ]);

    // Sales by Category in period
    const salesByCategory = await Sale.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.category',
          totalRevenue: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    const lowStockProducts = await Product.find({ stock: { $lte: 10 } }).sort({ stock: 1 });

    res.status(200).json({
      mode: periodInfo.mode,
      refDate: periodInfo.refDate.toISOString(),
      label,
      startDate,
      endDate,
      totalSalesAmount,
      totalCostAmount,
      netProfit,
      profit,
      loss,
      profitMargin,
      totalSalesCount: salesInPeriod.length,
      salesByDate,
      bestSellingProducts,
      salesByCategory,
      lowStockProducts
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating reports', error: error.message });
  }
};
