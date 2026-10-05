const Product = require('../models/Product');
const Sale = require('../models/Sale');

// GET /api/dashboard
exports.getDashboardData = async (req, res) => {
  try {
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

    // 5. Net Profit (Total Revenue - Total Cost)
    const profitAgg = await Sale.aggregate([
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

    // 7. Simple Sales Chart Data (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const salesChartRaw = await Sale.aggregate([
      { $match: { saleDate: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          totalSales: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build complete array for last 7 days (including days with 0 sales)
    const salesChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = salesChartRaw.find(item => item._id === dateStr);
      salesChart.push({
        date: dateStr,
        dayLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        totalSales: found ? found.totalSales : 0,
        count: found ? found.count : 0
      });
    }

    res.status(200).json({
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
