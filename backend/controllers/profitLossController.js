const Sale = require('../models/Sale');

// GET /api/profit-loss
exports.getProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.saleDate = {};
      if (startDate) matchQuery.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.saleDate.$lte = end;
      }
    }

    // 1. Overall Aggregation
    const agg = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          cost: { $sum: '$totalCostAmount' },
          profit: { $sum: '$profit' },
          totalSalesCount: { $sum: 1 }
        }
      }
    ]);

    const result = agg.length > 0 ? agg[0] : { revenue: 0, cost: 0, profit: 0, totalSalesCount: 0 };
    const revenue = result.revenue || 0;
    const cost = result.cost || 0;
    const netProfit = result.profit !== undefined ? result.profit : (revenue - cost);

    const profit = netProfit > 0 ? netProfit : 0;
    const loss = netProfit < 0 ? Math.abs(netProfit) : 0;

    // Prevent division-by-zero
    const profitMargin = revenue > 0 ? parseFloat(((netProfit / revenue) * 100).toFixed(2)) : 0;

    // 2. Trend Data (Daily Revenue vs Cost & Profit)
    const trendRaw = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          revenue: { $sum: '$totalAmount' },
          cost: { $sum: '$totalCostAmount' },
          profit: { $sum: '$profit' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      revenue,
      cost,
      netProfit,
      profit,
      loss,
      profitMargin,
      totalSalesCount: result.totalSalesCount || 0,
      trendData: trendRaw.map(item => ({
        date: item._id,
        revenue: item.revenue,
        cost: item.cost,
        profit: item.profit,
        count: item.count
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Profit & Loss data', error: error.message });
  }
};
