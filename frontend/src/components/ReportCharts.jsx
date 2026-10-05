import React from 'react';

// 1. Sales Trend Chart (Line / Bar Chart)
export function SalesTrendChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">No sales trend data available</div>;
  }

  const maxSales = Math.max(...data.map(d => d.totalSales), 100);

  return (
    <div className="chart-wrapper">
      <div className="bar-chart-container">
        {data.map((item, idx) => {
          const heightPercent = Math.max((item.totalSales / maxSales) * 100, 5);
          return (
            <div key={idx} className="chart-bar-item">
              <div className="bar-column-wrapper">
                <span className="bar-val-tooltip">
                  ₹{item.totalSales.toLocaleString()} ({item.totalQuantity} items)
                </span>
                <div
                  className="bar-column"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <div className="bar-date-label">{item._id}</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .chart-wrapper {
          width: 100%;
          padding-top: 0.5rem;
        }
        .bar-chart-container {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 200px;
          gap: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }
        .chart-bar-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
        }
        .bar-column-wrapper {
          width: 100%;
          max-width: 42px;
          height: 160px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          position: relative;
        }
        .bar-column {
          width: 100%;
          background: linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%);
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease, opacity 0.2s ease;
        }
        .bar-column-wrapper:hover .bar-column {
          opacity: 0.85;
        }
        .bar-val-tooltip {
          position: absolute;
          top: -30px;
          background-color: var(--text-main);
          color: var(--card-bg);
          font-size: 0.725rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 10;
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .bar-column-wrapper:hover .bar-val-tooltip {
          opacity: 1;
        }
        .bar-date-label {
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.6rem;
          color: var(--text-main);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

// 2. Top-Selling Products (Horizontal Bar Chart)
export function TopSellingChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">No top-selling products data available</div>;
  }

  const maxQty = Math.max(...data.map(d => d.totalQuantitySold), 1);

  return (
    <div className="horizontal-bar-list">
      {data.map((item, idx) => {
        const widthPercent = Math.max((item.totalQuantitySold / maxQty) * 100, 8);
        return (
          <div key={idx} className="hbar-item">
            <div className="hbar-info">
              <span className="hbar-name">{item.name}</span>
              <span className="hbar-val">
                <strong>{item.totalQuantitySold} sold</strong> (₹{item.totalRevenue?.toLocaleString()})
              </span>
            </div>
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </div>
        );
      })}

      <style>{`
        .horizontal-bar-list {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          padding-top: 0.5rem;
        }
        .hbar-item {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .hbar-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
        }
        .hbar-name {
          font-weight: 600;
          color: var(--text-main);
        }
        .hbar-val {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .hbar-track {
          width: 100%;
          height: 10px;
          background-color: var(--table-header-bg);
          border-radius: 6px;
          overflow: hidden;
        }
        .hbar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);
          border-radius: 6px;
          transition: width 0.4s ease;
        }
      `}</style>
    </div>
  );
}

// 3. Sales by Category (Pie / Donut Chart)
export function CategoryPieChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">No category sales data available</div>;
  }

  const totalRev = data.reduce((sum, item) => sum + item.totalRevenue, 0) || 1;

  // Warm theme colors for pie slices
  const colors = ['#C96A3D', '#D99A3D', '#8C52FF', '#2E7D32', '#0088FE', '#FF8042'];

  let cumulativeAngle = 0;

  const slices = data.map((item, idx) => {
    const percentage = item.totalRevenue / totalRev;
    const angle = percentage * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      ...item,
      percentage: (percentage * 100).toFixed(1),
      color: colors[idx % colors.length],
      startAngle,
      angle
    };
  });

  return (
    <div className="donut-chart-container">
      <div className="donut-svg-wrapper">
        <svg viewBox="0 0 100 100" className="donut-svg">
          {slices.map((slice, idx) => {
            const path = getSectorPath(50, 50, 42, 24, slice.startAngle, slice.startAngle + slice.angle);
            return (
              <path
                key={idx}
                d={path}
                fill={slice.color}
                className="donut-slice"
              >
                <title>{`${slice._id}: ₹${slice.totalRevenue.toLocaleString()} (${slice.percentage}%)`}</title>
              </path>
            );
          })}
        </svg>
        <div className="donut-center-text">
          <span className="donut-total-val">₹{totalRev.toLocaleString()}</span>
          <span className="donut-total-lbl">Total Sales</span>
        </div>
      </div>

      <div className="donut-legend">
        {slices.map((slice, idx) => (
          <div key={idx} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: slice.color }} />
            <span className="legend-name">{slice._id}</span>
            <span className="legend-pct">{slice.percentage}%</span>
          </div>
        ))}
      </div>

      <style>{`
        .donut-chart-container {
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 1.5rem;
          flex-wrap: wrap;
          padding-top: 0.5rem;
        }
        .donut-svg-wrapper {
          position: relative;
          width: 170px;
          height: 170px;
        }
        .donut-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }
        .donut-slice {
          transition: opacity 0.2s ease, transform 0.2s ease;
          cursor: pointer;
        }
        .donut-slice:hover {
          opacity: 0.85;
        }
        .donut-center-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .donut-total-val {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-main);
        }
        .donut-total-lbl {
          font-size: 0.68rem;
          color: var(--text-muted);
        }
        .donut-legend {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          min-width: 140px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .legend-name {
          color: var(--text-main);
          font-weight: 600;
          flex: 1;
        }
        .legend-pct {
          color: var(--text-muted);
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
}

// SVG Arc Math Helper
function getSectorPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  // Prevent full 360 degree path glitch
  if (endAngle - startAngle >= 359.99) {
    endAngle = startAngle + 359.99;
  }

  const rad = Math.PI / 180;
  const x1 = cx + outerRadius * Math.cos(startAngle * rad);
  const y1 = cy + outerRadius * Math.sin(startAngle * rad);
  const x2 = cx + outerRadius * Math.cos(endAngle * rad);
  const y2 = cy + outerRadius * Math.sin(endAngle * rad);

  const x3 = cx + innerRadius * Math.cos(endAngle * rad);
  const y3 = cy + innerRadius * Math.sin(endAngle * rad);
  const x4 = cx + innerRadius * Math.cos(startAngle * rad);
  const y4 = cy + innerRadius * Math.sin(startAngle * rad);

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${x1} ${y1}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
    'Z'
  ].join(' ');
}
