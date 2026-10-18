import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Package,
  AlertOctagon,
  Printer,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Award
} from 'lucide-react';
import KPICard from '../components/KPICard';
import { SalesVsProfitChart } from '../components/ProfitLossCharts';
import { useApp } from '../context/AppContext';

export default function ProfitLoss() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState('week');
  const [refDate, setRefDate] = useState(new Date());

  // Custom date range state
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  const { t } = useApp();

  const filterModes = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const fetchProfitLoss = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const params = {
        mode,
        refDate: refDate.toISOString()
      };
      if (mode === 'custom') {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const res = await axios.get('/api/profit-loss', { params });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch profit loss data', err);
      setLoadError(err.response?.data?.message || 'Failed to load Profit & Loss data.');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (direction) => {
    const newDate = new Date(refDate);
    if (mode === 'today') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (mode === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else if (mode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (mode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }
    setRefDate(newDate);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setRefDate(new Date());
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (new Date(customStart) > new Date(customEnd)) {
      alert('Start date cannot be after end date');
      return;
    }
    fetchProfitLoss();
  };

  useEffect(() => {
    fetchProfitLoss();
  }, [mode, refDate]);

  // Basic CSV Export
  const exportCSV = () => {
    if (!data) return;
    const lines = [];
    lines.push(['Profit & Loss Report - Retail Manager']);
    lines.push([`Period: ${data.label || mode}`]);
    lines.push([`Generated On: ${new Date().toLocaleString()}`]);
    lines.push([]);
    lines.push(['Key Financial Metrics']);
    lines.push(['Sales (Revenue)', `INR ${data.sales || data.revenue || 0}`]);
    lines.push(['Cost of Items Sold', `INR ${data.costOfItemsSold !== undefined ? data.costOfItemsSold : data.cost || 0}`]);
    lines.push(['Gross Profit', `INR ${data.grossProfit !== undefined ? data.grossProfit : data.profit || 0}`]);
    lines.push(['Profit Margin', `${data.profitMargin || 0}%`]);
    lines.push(['Recorded Store Expenses', `INR ${data.recordedExpenses || 0}`]);
    lines.push(['Profit After Recorded Expenses', `INR ${data.profitAfterExpenses !== undefined ? data.profitAfterExpenses : data.netProfit || 0}`]);
    lines.push([]);

    if (data.bestSellers && data.bestSellers.length > 0) {
      lines.push(['Top Best-Selling Products in this Period']);
      lines.push(['Product Name', 'Category', 'Units Sold', 'Total Sales (INR)', 'Gross Profit (INR)', 'Margin %']);
      data.bestSellers.forEach((p) => {
        lines.push([
          `"${p.name.replace(/"/g, '""')}"`,
          `"${(p.category || 'General').replace(/"/g, '""')}"`,
          p.unitsSold,
          p.sales,
          p.profit,
          `${p.marginPercent}%`
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + lines.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `profit_loss_${mode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const {
    sales = 0,
    revenue = 0,
    costOfItemsSold = 0,
    cost = 0,
    grossProfit = 0,
    profit = 0,
    loss = 0,
    recordedExpenses = 0,
    profitAfterExpenses = 0,
    profitMargin = 0,
    totalSalesCount = 0,
    cancelledSalesCount = 0,
    trendData = [],
    bestSellers = []
  } = data || {};

  const effectiveSales = sales || revenue || 0;
  const effectiveCost = costOfItemsSold !== undefined ? costOfItemsSold : (cost || 0);
  const effectiveGrossProfit = grossProfit !== undefined ? grossProfit : (profit > 0 ? profit : (effectiveSales - effectiveCost));
  const effectiveProfitAfterExpenses = profitAfterExpenses !== undefined ? profitAfterExpenses : effectiveGrossProfit;
  const isNetLoss = effectiveGrossProfit < 0;

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header space-between flex-wrap">
        <div>
          <h1 className="page-title">{t('profitLossTitle') || 'Profit & Loss'}</h1>
          <p className="page-subtitle">
            {t('profitLossSubtitle') || 'Overview of your sales, item costs, and gross profit for a simple small shop'}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchProfitLoss}
            title="Refresh Data"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={exportCSV}
            title="Export summary to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            title="Print this statement"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div
        className="card mb-4"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {filterModes.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`btn btn-sm ${mode === m.value ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: '20px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.825rem',
                fontWeight: 600
              }}
              onClick={() => handleModeChange(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Period Navigation */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          {mode !== 'custom' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleNavigate(-1)}
              style={{ padding: '0.3rem 0.55rem' }}
              title="Previous period"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div
            style={{
              padding: '0.35rem 0.8rem',
              backgroundColor: 'var(--table-header-bg)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              whiteSpace: 'nowrap'
            }}
          >
            {data?.label || 'Loading...'}
          </div>

          {mode !== 'custom' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleNavigate(1)}
              style={{ padding: '0.3rem 0.55rem' }}
              title="Next period"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Range Inline Bar */}
      {mode === 'custom' && (
        <form
          onSubmit={handleApplyCustom}
          className="card mb-4"
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'var(--table-header-bg)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>From:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px', height: '34px' }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>To:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px', height: '34px' }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ height: '34px' }}>
            Apply Filter
          </button>
        </form>
      )}

      {loading && !data ? (
        <div className="card mb-4" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Calculating Profit & Loss figures...</p>
        </div>
      ) : loadError ? (
        <div className="card mb-4" style={{ padding: '1.5rem', backgroundColor: 'var(--badge-out-of-stock-bg)' }}>
          <p style={{ color: 'var(--badge-out-of-stock-color)', fontWeight: 600 }}>{loadError}</p>
        </div>
      ) : (
        <>
          {/* Key Financial Metrics (4 Clear Cards) */}
          <div className="kpi-grid">
            {/* 1. Sales */}
            <KPICard
              label="Sales (Revenue)"
              value={`₹${Math.round(effectiveSales).toLocaleString()}`}
              icon={TrendingUp}
              color="var(--badge-in-stock-color)"
            />

            {/* 2. Cost of Items Sold */}
            <KPICard
              label="Cost of Items Sold"
              value={`₹${Math.round(effectiveCost).toLocaleString()}`}
              icon={Package}
              color="var(--badge-out-of-stock-color)"
            />

            {/* 3. Gross Profit */}
            <KPICard
              label={isNetLoss ? 'Gross Loss' : 'Gross Profit'}
              value={`₹${Math.round(Math.abs(effectiveGrossProfit)).toLocaleString()}`}
              icon={isNetLoss ? AlertOctagon : PieChart}
              color={isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)'}
            />

            {/* 4. Profit After Recorded Expenses */}
            <KPICard
              label="Profit After Expenses"
              value={`₹${Math.round(effectiveProfitAfterExpenses).toLocaleString()}`}
              icon={DollarSign}
              color={effectiveProfitAfterExpenses >= 0 ? 'var(--badge-in-stock-color)' : 'var(--badge-out-of-stock-color)'}
            />
          </div>

          {/* Simple Explanation Banner */}
          <div
            className="card mb-4"
            style={{
              backgroundColor: isNetLoss ? 'var(--badge-out-of-stock-bg)' : 'var(--kpi-icon-bg)',
              borderColor: isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.1rem 1.5rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)' }}>
                {effectiveSales === 0
                  ? 'ℹ️ No Completed Sales in this Period'
                  : isNetLoss
                  ? '⚠️ Operating at a Loss'
                  : '🎉 Profitable Retail Period'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {effectiveSales === 0
                  ? 'Select another date range or record sales transactions to see your financial performance.'
                  : isNetLoss
                  ? `Cost of items sold (₹${effectiveCost.toLocaleString()}) exceeds sales revenue (₹${effectiveSales.toLocaleString()}) by ₹${Math.abs(effectiveGrossProfit).toLocaleString()}.`
                  : `Generated ₹${effectiveGrossProfit.toLocaleString()} gross profit from ₹${effectiveSales.toLocaleString()} in sales (${profitMargin}% margin). No store expenses are recorded for this period, so Profit After Expenses equals Gross Profit.`}
              </p>
              {cancelledSalesCount > 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Note: {cancelledSalesCount} cancelled order(s) excluded from sales and item costs.
                </p>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)' }}>
                {effectiveGrossProfit >= 0 ? `+₹${Math.round(effectiveGrossProfit).toLocaleString()}` : `-₹${Math.round(Math.abs(effectiveGrossProfit)).toLocaleString()}`}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Margin: {profitMargin}% • {totalSalesCount} completed orders
              </span>
            </div>
          </div>

          {/* ONE CLEAR CHART: Sales vs Gross Profit Over Time */}
          <div className="card mb-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <TrendingUp size={18} color="var(--primary)" />
                Sales & Profit Comparison Over Time
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Comparing revenue earned and gross profit retained
              </span>
            </div>
            <div className="responsive-scroll-container">
              <SalesVsProfitChart data={trendData} />
            </div>
          </div>

          {/* Small Best-Selling Products Section */}
          <div className="card mb-4">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Award size={18} color="var(--secondary)" />
              Top Best-Selling Products in this Period
            </h3>

            {bestSellers.length === 0 ? (
              <p className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                No product sales recorded in this reporting period.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Units Sold</th>
                      <th style={{ textAlign: 'right' }}>Total Sales</th>
                      <th style={{ textAlign: 'right' }}>Gross Profit</th>
                      <th style={{ textAlign: 'right' }}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellers.map((item, idx) => (
                      <tr key={idx}>
                        <td className="fw-600">{item.name}</td>
                        <td className="text-muted text-sm">{item.category}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.unitsSold}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Math.round(item.sales).toLocaleString()}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: item.profit >= 0 ? 'var(--badge-in-stock-color)' : 'var(--badge-out-of-stock-color)'
                          }}
                        >
                          ₹{Math.round(item.profit).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.marginPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
