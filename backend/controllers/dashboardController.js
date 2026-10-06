const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { buildPeriodMatch } = require('../utils/periodUtils');

// GET /api/dashboard?period=7days|thisWeek|prevWeek|30days|90days|all
exports.getDashboardData = async (req, res) => {
  try {
    const period = req.query.period || '7days';
    const periodMatch = buildPeriodMatch(period);

    // 1. Total Products
    const totalProducts = await Product.countDocuments();

    // 2. Total Stock across all products
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

    // 4. Low Stock Products (stock <= 10)
    const lowStockProducts = await Product.find({ stock: { $lte: 10 } }).sort({ stock: 1 });
    const lowStockCount = lowStockProducts.length;

    // 5. Net Profit for selected period (or overall)
    const profitAgg = await Sale.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalCost: { $sum: '$totalCostAmount' },
          netProfit: { $sum: '$profit' }
        }
      }
    ]);
    const netProfit = profitAgg.length > 0 ? profitAgg[0].netProfit : 0;

    // 6. Recent Sales (Top 5)
    const recentSales = await Sale.find()
      .populate('customer', 'name email')
      .populate('product', 'name price sellingPrice costPrice')
      .sort({ saleDate: -1 })
      .limit(5);

    // 7. Sales Chart Data for Selected Period
    const salesChartRaw = await Sale.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          totalSales: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const salesChart = [];
    if (periodMatch.saleDate && periodMatch.saleDate.$gte && (period === '7days' || period === 'thisWeek' || period === 'prevWeek')) {
      const startDate = new Date(periodMatch.saleDate.$gte);
      const endDate = periodMatch.saleDate.$lte ? new Date(periodMatch.saleDate.$lte) : new Date();

      const curr = new Date(startDate);
      while (curr <= endDate) {
        const dateStr = curr.toISOString().split('T')[0];
        const found = salesChartRaw.find(item => item._id === dateStr);
        salesChart.push({
          date: dateStr,
          dayLabel: curr.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          totalSales: found ? found.totalSales : 0,
          count: found ? found.count : 0
        });
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      // 30days, 90days, or all time
      salesChartRaw.forEach((item) => {
        const d = new Date(item._id);
        salesChart.push({
          date: item._id,
          dayLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          totalSales: item.totalSales,
          count: item.count
        });
      });
    }

    res.status(200).json({
      period,
      totalProducts,
      totalStock,
      todaysSales,
      lowStockCount,
      netProfit,
      recentSales,
      lowStockProducts,
      salesChart
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
};
