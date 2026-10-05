import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, DollarSign, PieChart, Percent, AlertOctagon } from 'lucide-react';
import KPICard from '../components/KPICard';
import { RevenueVsCostChart, ProfitTrendChart } from '../components/ProfitLossCharts';
import { useApp } from '../context/AppContext';

export default function ProfitLoss() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useApp();

  const fetchProfitLoss = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/profit-loss');
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch profit loss data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitLoss();
  }, []);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">Loading Profit & Loss statement...</div>
      </div>
    );
  }

  const {
    revenue = 0,
    cost = 0,
    netProfit = 0,
    profit = 0,
    loss = 0,
    profitMargin = 0,
    trendData = []
  } = data || {};

  const isNetLoss = netProfit < 0;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('profitLossTitle')}</h1>
          <p className="page-subtitle">{t('profitLossSubtitle')}</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KPICard
          label={t('totalRevenue')}
          value={`₹${revenue.toLocaleString()}`}
          icon={TrendingUp}
          color="var(--badge-in-stock-color)"
        />
        <KPICard
          label={t('totalCost')}
          value={`₹${cost.toLocaleString()}`}
          icon={DollarSign}
          color="var(--badge-out-of-stock-color)"
        />
        <KPICard
          label={isNetLoss ? t('netLoss') : t('netProfit')}
          value={`₹${(isNetLoss ? loss : profit).toLocaleString()}`}
          icon={isNetLoss ? AlertOctagon : PieChart}
          color={isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)'}
        />
        <KPICard
          label={t('profitMargin')}
          value={`${profitMargin}%`}
          icon={Percent}
          color="var(--secondary)"
        />
      </div>

      {/* Profit / Loss Banner */}
      <div
        className="card mb-4"
        style={{
          backgroundColor: isNetLoss ? 'var(--badge-out-of-stock-bg)' : 'var(--kpi-icon-bg)',
          borderColor: isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.75rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)' }}>
            {isNetLoss ? '⚠️ Operating at a Net Loss' : '🎉 Positive Net Profit Margin'}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
            {isNetLoss
              ? `Total cost (₹${cost.toLocaleString()}) exceeds revenue (₹${revenue.toLocaleString()}) by ₹${loss.toLocaleString()}.`
              : `Generated ₹${profit.toLocaleString()} net profit from ₹${revenue.toLocaleString()} revenue (${profitMargin}% margin).`}
          </p>
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)' }}>
          {isNetLoss ? `-₹${loss.toLocaleString()}` : `+₹${profit.toLocaleString()}`}
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Chart 1: Revenue vs Cost */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="var(--primary)" />
            {t('revenueVsCost')}
          </h3>
          <RevenueVsCostChart data={trendData} />
        </div>

        {/* Chart 2: Profit Trend */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={18} color="var(--secondary)" />
            {t('profitTrend')}
          </h3>
          <ProfitTrendChart data={trendData} />
        </div>
      </div>
    </div>
  );
}
