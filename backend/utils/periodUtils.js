/**
 * periodUtils.js
 * Comprehensive date-range parsing & chart breakdown generator for Today / Week / Month / Year / Custom reporting.
 */

function getPeriodDetails(mode = 'week', refDateInput, customStart, customEnd) {
  let refDate = refDateInput ? new Date(refDateInput) : new Date();
  if (isNaN(refDate.getTime())) {
    refDate = new Date();
  }

  let startDate, endDate, label;
  let modeLower = (mode || 'week').toLowerCase();

  // Map legacy mode parameters if passed
  if (modeLower === '7days' || modeLower === 'thisweek') modeLower = 'week';
  if (modeLower === 'prevweek') modeLower = 'week';
  if (modeLower === '30days' || modeLower === '90days' || modeLower === 'thismonth') modeLower = 'month';
  if (modeLower === 'all' || modeLower === 'thisyear') modeLower = 'year';

  if (modeLower === 'today') {
    startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
    endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    label = `Today (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;

  } else if (modeLower === 'week') {
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

  } else if (modeLower === 'custom') {
    if (customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      startDate = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
      endDate = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
    } else {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 29, 0, 0, 0, 0);
      endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    }
    const sStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const eStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    label = `${sStr} – ${eStr}`;

  } else {
    return getPeriodDetails('week', refDateInput, customStart, customEnd);
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
 * Generate aggregated chart breakdown by Day, Week, or Month.
 * Always filters out CANCELLED sales so chart buckets reflect actual sales.
 */
function buildChartBreakdown(mode, startDate, endDate, rawSales = []) {
  const chartItems = [];
  const modeLower = (mode || 'week').toLowerCase();

  // Exclude cancelled sales
  const sales = rawSales.filter(s => s.status !== 'CANCELLED');

  if (modeLower === 'today') {
    // 4 periods: Morning (0-12), Afternoon (12-16), Evening (16-20), Night (20-24)
    const timeBlocks = [
      { name: 'Morning (open–12pm)', startHour: 0, endHour: 12 },
      { name: 'Afternoon (12pm–4pm)', startHour: 12, endHour: 16 },
      { name: 'Evening (4pm–8pm)', startHour: 16, endHour: 20 },
      { name: 'Night (8pm–close)', startHour: 20, endHour: 24 }
    ];

    timeBlocks.forEach(b => {
      const bSales = sales.filter(s => {
        const h = new Date(s.saleDate || s.createdAt).getHours();
        return h >= b.startHour && h < b.endHour;
      });

      const revenue = bSales.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
      const cost = bSales.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
      const profit = revenue - cost;
      const quantity = bSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

      chartItems.push({
        _id: b.name,
        date: b.name,
        dayLabel: b.name.split(' ')[0],
        label: b.name.split(' ')[0],
        totalSales: revenue,
        revenue,
        cost,
        profit,
        totalQuantity: quantity,
        count: bSales.length
      });
    });

  } else if (modeLower === 'week') {
    // 7 Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const curr = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayLabel = dayNames[i];

      const daySales = sales.filter(s => {
        const sDateStr = new Date(s.saleDate || s.createdAt).toISOString().split('T')[0];
        return sDateStr === dateStr;
      });

      const revenue = daySales.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
      const cost = daySales.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
      const profit = revenue - cost;
      const quantity = daySales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

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
      const wSales = sales.filter(s => {
        const d = new Date(s.saleDate || s.createdAt).getDate();
        return d >= w.start && d <= w.end;
      });

      const revenue = wSales.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
      const cost = wSales.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
      const profit = revenue - cost;
      const quantity = wSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

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
      const mSales = sales.filter(s => {
        const d = new Date(s.saleDate || s.createdAt);
        return d.getFullYear() === targetYear && d.getMonth() === m;
      });

      const revenue = mSales.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
      const cost = mSales.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
      const profit = revenue - cost;
      const quantity = mSales.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

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

  } else if (modeLower === 'custom') {
    // Aggregate by days for short custom range (<= 31 days) or weeks for longer
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 31) {
      const curr = new Date(startDate);
      while (curr <= endDate) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayLabel = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const daySales = sales.filter(s => {
          const sDateStr = new Date(s.saleDate || s.createdAt).toISOString().split('T')[0];
          return sDateStr === dateStr;
        });

        const revenue = daySales.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
        const cost = daySales.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
        const profit = revenue - cost;

        chartItems.push({
          _id: dateStr,
          date: dateStr,
          dayLabel,
          label: dayLabel,
          totalSales: revenue,
          revenue,
          cost,
          profit,
          count: daySales.length
        });

        curr.setDate(curr.getDate() + 1);
      }
    } else {
      // Chunk into 4 parts
      const stepDays = Math.ceil(diffDays / 4);
      for (let i = 0; i < 4; i++) {
        const bStart = new Date(startDate.getTime() + (i * stepDays * 24 * 60 * 60 * 1000));
        const bEnd = new Date(Math.min(endDate.getTime(), bStart.getTime() + ((stepDays - 1) * 24 * 60 * 60 * 1000)));
        const bLabel = `${bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${bEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        const bSales = sales.filter(s => {
          const d = new Date(s.saleDate || s.createdAt);
          return d >= bStart && d <= bEnd;
        });

        const revenue = bSales.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
        const cost = bSales.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
        const profit = revenue - cost;

        chartItems.push({
          _id: `Part ${i + 1}`,
          date: bLabel,
          dayLabel: `P${i + 1}`,
          label: bLabel,
          totalSales: revenue,
          revenue,
          cost,
          profit,
          count: bSales.length
        });
      }
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
