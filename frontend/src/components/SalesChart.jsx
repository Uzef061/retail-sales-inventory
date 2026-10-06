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
          const heightPercent = Math.max((item.totalSales / maxSale) * 76, 5);

          let alignClass = 'tip-center';
          if (index === 0) alignClass = 'tip-left';
          else if (index === data.length - 1) alignClass = 'tip-right';

          return (
            <div key={index} className="chart-col">
              <div className="bar-wrapper">
                <div
                  className="bar"
                  style={{ height: `${heightPercent}%` }}
                >
                  <span className={`bar-tooltip ${alignClass}`}>
                    ₹{item.totalSales.toLocaleString()} ({item.count} sales)
                  </span>
                </div>
              </div>
              <div className="bar-label">{item.dayLabel ? item.dayLabel.split(',')[0] : ''}</div>
              <div className="bar-date">{item.date ? item.date.split('-').slice(1).join('/') : ''}</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .sales-chart-container {
          width: 100%;
          padding-top: 2.2rem;
          overflow: visible;
        }

        .chart-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 190px;
          gap: 0.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
          overflow: visible;
        }

        .chart-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
          overflow: visible;
        }

        .bar-wrapper {
          width: 100%;
          max-width: 36px;
          height: 150px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          position: relative;
          overflow: visible;
        }

        .bar {
          width: 100%;
          background: linear-gradient(180deg, var(--primary) 0%, #D99A3D 100%);
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease, opacity 0.2s ease;
          position: relative;
          overflow: visible;
        }

        .bar-wrapper:hover .bar {
          opacity: 0.88;
        }

        .bar-tooltip {
          position: absolute;
          bottom: calc(100% + 6px);
          background-color: var(--text-main);
          color: #FFFFFF;
          font-size: 0.725rem;
          font-weight: 700;
          padding: 0.25rem 0.5rem;
          border-radius: 5px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 50;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .tip-center {
          left: 50%;
          transform: translateX(-50%);
        }

        .tip-left {
          left: 0;
          transform: translateX(0);
        }

        .tip-right {
          right: 0;
          transform: translateX(0);
        }

        .bar-wrapper:hover .bar-tooltip,
        .bar:hover .bar-tooltip {
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
