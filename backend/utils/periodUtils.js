/**
 * Build MongoDB date match object for filtering sales by period or custom date range.
 * Supported periods:
 * - '7days': rolling 7-day period
 * - 'thisWeek': current calendar week (Sunday to now)
 * - 'prevWeek': immediately preceding calendar week (previous Sunday 00:00 to Saturday 23:59)
 * - '30days': rolling 30-day period
 * - '90days': rolling 90-day period
 * - 'all': all-time transactions
 */
const buildPeriodMatch = (period, startDate, endDate) => {
  const match = {};
  const now = new Date();

  // Custom date range takes priority if provided
  if (startDate || endDate) {
    match.saleDate = {};
    if (startDate) match.saleDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      match.saleDate.$lte = end;
    }
    return match;
  }

  if (period === 'thisWeek') {
    const start = new Date(now);
    const day = start.getDay(); // 0 is Sunday
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    match.saleDate = { $gte: start, $lte: end };
  } else if (period === 'prevWeek') {
    const startOfThisWeek = new Date(now);
    const day = startOfThisWeek.getDay();
    startOfThisWeek.setDate(startOfThisWeek.getDate() - day);
    startOfThisWeek.setHours(0, 0, 0, 0);

    const start = new Date(startOfThisWeek);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(startOfThisWeek);
    end.setMilliseconds(-1); // Saturday 23:59:59.999 of previous week

    match.saleDate = { $gte: start, $lte: end };
  } else if (period === '30days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    match.saleDate = { $gte: start, $lte: end };
  } else if (period === '90days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 89);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    match.saleDate = { $gte: start, $lte: end };
  } else if (period === 'all') {
    // All time - no date restriction
  } else {
    // Default '7days' (rolling 7 days)
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    match.saleDate = { $gte: start, $lte: end };
  }

  return match;
};

module.exports = { buildPeriodMatch };
