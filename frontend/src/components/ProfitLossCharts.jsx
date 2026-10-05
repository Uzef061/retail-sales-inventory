import React from 'react';

// Chart 1: Revenue vs Cost Comparison
export function RevenueVsCostChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">No revenue vs cost data available</div>;
  }

  const maxVal = Math.max(
    ...data.flatMap(d => [d.revenue || 0, d.cost || 0]),
    100
  );

  return (
    <div className="rev-cost-container">
      <div className="rev-cost-legend">
        <div className="legend-chip">
          <span className="chip-dot" style={{ backgroundColor: 'var(--badge-in-stock-color)' }} />
          <span>Revenue</span>
        </div>
        <div className="legend-chip">
          <span className="chip-dot" style={{ backgroundColor: 'var(--badge-out-of-stock-color)' }} />
          <span>Cost</span>
        </div>
      </div>

      <div className="rev-cost-bars">
        {data.map((item, idx) => {
          const revHeight = Math.max(((item.revenue || 0) / maxVal) * 100, 4);
          const costHeight = Math.max(((item.cost || 0) / maxVal) * 100, 4);

          return (
            <div key={idx} className="rev-cost-group">
              <div className="group-columns">
                {/* Revenue Bar */}
                <div className="col-bar-wrap">
                  <span className="col-tooltip">Revenue: ₹{(item.revenue || 0).toLocaleString()}</span>
                  <div
                    className="col-bar rev-bar"
                    style={{ height: `${revHeight}%` }}
                  />
                </div>

                {/* Cost Bar */}
                <div className="col-bar-wrap">
                  <span className="col-tooltip">Cost: ₹{(item.cost || 0).toLocaleString()}</span>
                  <div
                    className="col-bar cost-bar"
                    style={{ height: `${costHeight}%` }}
                  />
                </div>
              </div>
              <div className="rev-cost-date">{item.date}</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .rev-cost-container {
          width: 100%;
          padding-top: 0.5rem;
        }
        .rev-cost-legend {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1rem;
          justify-content: flex-end;
        }
        .legend-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.825rem;
          font-weight: 600;
          color: var(--text-main);
        }
        .chip-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
        }
        .rev-cost-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 200px;
          gap: 0.85rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }
        .rev-cost-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
        }
        .group-columns {
          width: 100%;
          max-width: 50px;
          height: 160px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 4px;
        }
        .col-bar-wrap {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: flex-end;
          position: relative;
        }
        .col-bar {
          width: 100%;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease;
        }
        .rev-bar {
          background-color: var(--badge-in-stock-color);
        }
        .cost-bar {
          background-color: var(--badge-out-of-stock-color);
        }
        .col-tooltip {
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          background-color: var(--text-main);
          color: var(--card-bg);
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.2rem 0.45rem;
          border-radius: 4px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 10;
        }
        .col-bar-wrap:hover .col-tooltip {
          opacity: 1;
        }
        .rev-cost-date {
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.5rem;
          color: var(--text-main);
        }
      `}</style>
    </div>
  );
}

// Chart 2: Profit Trend Chart
export function ProfitTrendChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">No profit trend data available</div>;
  }

  const maxProfit = Math.max(...data.map(d => Math.abs(d.profit || 0)), 100);

  return (
    <div className="profit-trend-container">
      <div className="profit-bars font-bold">
        {data.map((item, idx) => {
          const isPositive = (item.profit || 0) >= 0;
          const heightPercent = Math.max((Math.abs(item.profit || 0) / maxProfit) * 100, 5);

          return (
            <div key={idx} className="pbar-group">
              <div className="pbar-wrapper">
                <span className="pbar-tooltip">
                  {isPositive ? 'Profit' : 'Loss'}: ₹{Math.abs(item.profit || 0).toLocaleString()}
                </span>
                <div
                  className={`pbar-column ${isPositive ? 'profit-bg' : 'loss-bg'}`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <div className="pbar-date">{item.date}</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .profit-trend-container {
          width: 100%;
          padding-top: 0.5rem;
        }
        .profit-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 200px;
          gap: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }
        .pbar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
        }
        .pbar-wrapper {
          width: 100%;
          max-width: 38px;
          height: 160px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          position: relative;
        }
        .pbar-column {
          width: 100%;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease;
        }
        .profit-bg {
          background: linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%);
        }
        .loss-bg {
          background-color: var(--badge-out-of-stock-color);
        }
        .pbar-tooltip {
          position: absolute;
          top: -30px;
          background-color: var(--text-main);
          color: var(--card-bg);
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.2rem 0.45rem;
          border-radius: 4px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 10;
        }
        .pbar-wrapper:hover .pbar-tooltip {
          opacity: 1;
        }
        .pbar-date {
          font-size: 0.75rem;
          font-weight: 600;
          margin-top: 0.5rem;
          color: var(--text-main);
        }
      `}</style>
    </div>
  );
}
