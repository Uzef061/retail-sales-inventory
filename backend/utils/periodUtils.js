/**
 * periodUtils.js
 * Comprehensive date-range parsing & chart breakdown generator for Week / Month / Year reporting.
 */

function getPeriodDetails(mode = 'week', refDateInput) {
  let refDate = refDateInput ? new Date(refDateInput) : new Date();
  if (isNaN(refDate.getTime())) {
    refDate = new Date();
  }

  let startDate, endDate, label;
  let modeLower = (mode || 'week').toLowerCase();

  // Map legacy mode parameters if passed
  if (modeLower === '7days' || modeLower === 'thisweek') modeLower = 'week';
  if (modeLower === 'prevweek') modeLower = 'week';
  if (modeLower === '30days' || modeLower === '90days') modeLower = 'month';
  if (modeLower === 'all') modeLower = 'year';

  if (modeLower === 'week') {
    // Calendar week starting Monday 00:00:00.000 to Sunday 23:59:59.999
    const day = refDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMon = day === 0 ? 6 : day - 1;

    startDate = new Date(refDate);
    startDate.setDate(startDate.getDate() - diffToMon);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const sMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const eMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const sDay = startDate.getDate();
    const eDay = endDate.getDate();
    const year = endDate.getFullYear();

    if (sMonth === eMonth) {
      label = `${sMonth} ${sDay} – ${eDay}, ${year}`;
    } else {
      label = `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${year}`;
    }

  } else if (modeLower === 'month') {
    // Calendar month starting 1st 00:00:00.000 to last day 23:59:59.999
    startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0);
    endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);
    label = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  } else if (modeLower === 'year') {
    // Calendar year Jan 1 00:00:00.000 to Dec 31 23:59:59.999
    startDate = new Date(refDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    endDate = new Date(refDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    label = `${startDate.getFullYear()}`;

  } else {
    return getPeriodDetails('week', refDateInput);
  }

  return {
    mode: modeLower,
    refDate,
    startDate,
    endDate,
    label,
    matchQuery: {
      saleDate: { $gte: startDate, $lte: endDate }
    }
  };
}

/**
 * Generate aggregated chart breakdown by Day (Week mode), Week (Month mode), or Month (Year mode).
 */
function buildChartBreakdown(mode, startDate, endDate, rawSales = []) {
  const chartItems = [];
  const modeLower = (mode || 'week').toLowerCase();

  if (modeLower === 'week') {
    // 7 Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const curr = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayLabel = dayNames[i];

      const daySales = rawSales.filter(s => {
        const sDateStr = new Date(s.saleDate).toISOString().split('T')[0];
        return sDateStr === dateStr;
      });

      const revenue = daySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const cost = daySales.reduce((sum, s) => sum + (s.totalCostAmount || 0), 0);
      const profit = daySales.reduce((sum, s) => sum + (s.profit !== undefined ? s.profit : (s.totalAmount - s.totalCostAmount)), 0);
      const quantity = daySales.reduce((sum, s) => sum + (s.quantity || 0), 0);

      chartItems.push({
        _id: dateStr,
        date: dateStr,
        dayLabel: dayLabel,
        label: dayLabel,
        totalSales: revenue,
        revenue,
        cost,
        profit,
        totalQuantity: quantity,
        count: daySales.length
      });

      curr.setDate(curr.getDate() + 1);
    }

  } else if (modeLower === 'month') {
    // Aggregate by Week of Month (Week 1..4/5)
    const totalDays = endDate.getDate();
    const weekBuckets = [
      { name: 'Week 1', start: 1, end: 7 },
      { name: 'Week 2', start: 8, end: 14 },
      { name: 'Week 3', start: 15, end: 21 },
      { name: 'Week 4', start: 22, end: 28 }
    ];
    if (totalDays > 28) {
      weekBuckets.push({ name: 'Week 5', start: 29, end: totalDays });
    }

    weekBuckets.forEach(w => {
      const wSales = rawSales.filter(s => {
        const d = new Date(s.saleDate).getDate();
        return d >= w.start && d <= w.end;
      });

      const revenue = wSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const cost = wSales.reduce((sum, s) => sum + (s.totalCostAmount || 0), 0);
      const profit = wSales.reduce((sum, s) => sum + (s.profit !== undefined ? s.profit : (s.totalAmount - s.totalCostAmount)), 0);
      const quantity = wSales.reduce((sum, s) => sum + (s.quantity || 0), 0);

      chartItems.push({
        _id: w.name,
        date: `${w.name} (Days ${w.start}–${w.end})`,
        dayLabel: w.name,
        label: w.name,
        totalSales: revenue,
        revenue,
        cost,
        profit,
        totalQuantity: quantity,
        count: wSales.length
      });
    });

  } else if (modeLower === 'year') {
    // 12 Months: Jan..Dec
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const targetYear = startDate.getFullYear();

    for (let m = 0; m < 12; m++) {
      const mSales = rawSales.filter(s => {
        const d = new Date(s.saleDate);
        return d.getFullYear() === targetYear && d.getMonth() === m;
      });

      const revenue = mSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const cost = mSales.reduce((sum, s) => sum + (s.totalCostAmount || 0), 0);
      const profit = mSales.reduce((sum, s) => sum + (s.profit !== undefined ? s.profit : (s.totalAmount - s.totalCostAmount)), 0);
      const quantity = mSales.reduce((sum, s) => sum + (s.quantity || 0), 0);

      chartItems.push({
        _id: monthNames[m],
        date: `${monthNames[m]} ${targetYear}`,
        dayLabel: monthNames[m],
        label: monthNames[m],
        totalSales: revenue,
        revenue,
        cost,
        profit,
        totalQuantity: quantity,
        count: mSales.length
      });
    }
  }

  return chartItems;
}

// Backward compatibility export
const buildPeriodMatch = (period, startDate, endDate) => {
  const p = getPeriodDetails(period, startDate);
  return p.matchQuery;
};

module.exports = {
  getPeriodDetails,
  buildChartBreakdown,
  buildPeriodMatch
};
