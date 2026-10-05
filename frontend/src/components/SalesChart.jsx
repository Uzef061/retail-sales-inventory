import React from 'react';

export default function SalesChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">No sales data available for chart</div>;
  }

  const maxSale = Math.max(...data.map(d => d.totalSales), 100);

  return (
    <div className="sales-chart-container">
      <div className="chart-bars">
        {data.map((item, index) => {
          const heightPercent = Math.max((item.totalSales / maxSale) * 100, 4);
          return (
            <div key={index} className="chart-col">
              <div className="bar-wrapper">
                <span className="bar-tooltip">₹{item.totalSales.toLocaleString()} ({item.count} sales)</span>
                <div
                  className="bar"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <div className="bar-label">{item.dayLabel.split(',')[0]}</div>
              <div className="bar-date">{item.date.split('-').slice(1).join('/')}</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .sales-chart-container {
          width: 100%;
          padding-top: 1rem;
        }

        .chart-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 180px;
          gap: 0.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .chart-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
        }

        .bar-wrapper {
          width: 100%;
          max-width: 36px;
          height: 140px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          position: relative;
        }

        .bar {
          width: 100%;
          background: linear-gradient(180deg, var(--primary) 0%, #D99A3D 100%);
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease, opacity 0.2s ease;
        }

        .bar-wrapper:hover .bar {
          opacity: 0.85;
        }

        .bar-tooltip {
          position: absolute;
          top: -28px;
          background-color: var(--text-main);
          color: #FFF;
          font-size: 0.7rem;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 10;
        }

        .bar-wrapper:hover .bar-tooltip {
          opacity: 1;
        }

        .bar-label {
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.5rem;
          color: var(--text-main);
        }

        .bar-date {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
