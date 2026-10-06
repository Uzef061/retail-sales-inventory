const Sale = require('../models/Sale');
const { getPeriodDetails, buildChartBreakdown } = require('../utils/periodUtils');

// GET /api/profit-loss?mode=week|month|year&refDate=2026-10-06
exports.getProfitLoss = async (req, res) => {
  try {
    const mode = req.query.mode || req.query.period || 'week';
    const refDate = req.query.refDate || req.query.date;

    const periodInfo = getPeriodDetails(mode, refDate);
    const { matchQuery, label, startDate, endDate } = periodInfo;

    const salesInPeriod = await Sale.find(matchQuery);

    const revenue = salesInPeriod.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const cost = salesInPeriod.reduce((sum, s) => sum + (s.totalCostAmount || 0), 0);
    const netProfit = salesInPeriod.reduce((sum, s) => sum + (s.profit !== undefined ? s.profit : (s.totalAmount - s.totalCostAmount)), 0);

    const profit = netProfit > 0 ? netProfit : 0;
    const loss = netProfit < 0 ? Math.abs(netProfit) : 0;
    const profitMargin = revenue > 0 ? parseFloat(((netProfit / revenue) * 100).toFixed(2)) : 0;

    const trendData = buildChartBreakdown(periodInfo.mode, startDate, endDate, salesInPeriod);

    res.status(200).json({
      mode: periodInfo.mode,
      refDate: periodInfo.refDate.toISOString(),
      label,
      startDate,
      endDate,
      revenue,
      cost,
      netProfit,
      profit,
      loss,
      profitMargin,
      totalSalesCount: salesInPeriod.length,
      trendData
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Profit & Loss data', error: error.message });
  }
};
