const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { buildPeriodMatch } = require('../utils/periodUtils');

// GET /api/reports?period=7days|thisWeek|prevWeek|30days|90days|all
exports.getReports = async (req, res) => {
  try {
    const period = req.query.period || '7days';
    const periodMatch = buildPeriodMatch(period);

    // 1. Financial Summary for selected period
    const financialAgg = await Sale.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalCost: { $sum: '$totalCostAmount' },
          netProfit: { $sum: '$profit' },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    const fin = financialAgg.length > 0
      ? financialAgg[0]
      : { totalRevenue: 0, totalCost: 0, netProfit: 0, totalCount: 0 };

    const totalSalesAmount = fin.totalRevenue || 0;
    const totalCostAmount = fin.totalCost || 0;
    const netProfit = fin.netProfit !== undefined ? fin.netProfit : (totalSalesAmount - totalCostAmount);
    const profit = netProfit > 0 ? netProfit : 0;
    const loss = netProfit < 0 ? Math.abs(netProfit) : 0;
    const profitMargin = totalSalesAmount > 0 ? parseFloat(((netProfit / totalSalesAmount) * 100).toFixed(2)) : 0;
    const totalSalesCount = fin.totalCount || 0;

    // 2. Sales By Date for selected period
    const salesByDate = await Sale.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          totalSales: { $sum: '$totalAmount' },
          totalCost: { $sum: '$totalCostAmount' },
          profit: { $sum: '$profit' },
          totalQuantity: { $sum: '$quantity' },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Best-Selling Products for selected period
    const bestSellingProducts = await Sale.aggregate([
      { $match: periodMatch },
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

    // 4. Sales By Category for selected period
    const salesByCategory = await Sale.aggregate([
      { $match: periodMatch },
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

    // 5. Low-Stock Products
    const lowStockProducts = await Product.find({ stock: { $lte: 10 } }).sort({ stock: 1 });

    res.status(200).json({
      period,
      totalSalesAmount,
      totalCostAmount,
      netProfit,
      profit,
      loss,
      profitMargin,
      totalSalesCount,
      salesByDate,
      bestSellingProducts,
      salesByCategory,
      lowStockProducts
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating reports', error: error.message });
  }
};
