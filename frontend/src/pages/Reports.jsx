import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, Calendar, AlertTriangle, Award, PieChart, DollarSign, Percent } from 'lucide-react';
import KPICard from '../components/KPICard';
import { SalesTrendChart, TopSellingChart, CategoryPieChart } from '../components/ReportCharts';
import { useApp } from '../context/AppContext';

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useApp();

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/reports');
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">Generating reports summary...</div>
      </div>
    );
  }

  const {
    totalSalesAmount = 0,
    totalCostAmount = 0,
    netProfit = 0,
    profit = 0,
    loss = 0,
    profitMargin = 0,
    totalSalesCount = 0,
    salesByDate = [],
    bestSellingProducts = [],
    salesByCategory = [],
    lowStockProducts = []
  } = reports || {};

  const isNetLoss = netProfit < 0;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('reportsTitle')}</h1>
          <p className="page-subtitle">{t('reportsSubtitle')}</p>
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KPICard
          label={t('totalRevenue')}
          value={`₹${totalSalesAmount.toLocaleString()}`}
          icon={TrendingUp}
          color="var(--badge-in-stock-color)"
        />
        <KPICard
          label={t('totalCost')}
          value={`₹${totalCostAmount.toLocaleString()}`}
          icon={DollarSign}
          color="var(--badge-out-of-stock-color)"
        />
        <KPICard
          label={isNetLoss ? t('netLoss') : t('netProfit')}
          value={`₹${(isNetLoss ? loss : profit).toLocaleString()}`}
          icon={PieChart}
          color={isNetLoss ? 'var(--badge-out-of-stock-color)' : 'var(--primary)'}
        />
        <KPICard
          label={t('profitMargin')}
          value={`${profitMargin}%`}
          icon={Percent}
          color="var(--secondary)"
        />
      </div>

      {/* 3 Interactive Visualizations Section */}
      <div className="card mb-4">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} color="var(--primary)" />
          {t('salesTrend')}
        </h3>
        <SalesTrendChart data={salesByDate} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* 2. Top-Selling Products Visualization */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} color="var(--primary)" />
            {t('topSellingProducts')}
          </h3>
          <TopSellingChart data={bestSellingProducts} />
        </div>

        {/* 3. Sales by Category Visualization */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={18} color="var(--secondary)" />
            {t('salesByCategory')}
          </h3>
          <CategoryPieChart data={salesByCategory} />
        </div>
      </div>

      {/* Tables Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Best-Selling Products Table */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={18} color="var(--primary)" />
            {t('topSellingProducts')}
          </h3>

          {bestSellingProducts.length === 0 ? (
            <p className="empty-state">No sales data recorded yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('product')}</th>
                    <th>{t('category')}</th>
                    <th>{t('qtySold')}</th>
                    <th>{t('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSellingProducts.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-bold">{item.name}</td>
                      <td>{item.category}</td>
                      <td className="font-bold">{item.totalQuantitySold} {t('units')}</td>
                      <td className="font-bold" style={{ color: 'var(--primary)' }}>
                        ₹{item.totalRevenue?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sales Summary By Date Table */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="var(--secondary)" />
            {t('salesSummaryByDate')}
          </h3>

          {salesByDate.length === 0 ? (
            <p className="empty-state">No daily sales logged yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('orders')}</th>
                    <th>{t('itemsSold')}</th>
                    <th>{t('dailyRevenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByDate.map((row) => (
                    <tr key={row._id}>
                      <td className="font-bold">{row._id}</td>
                      <td>{row.salesCount}</td>
                      <td>{row.totalQuantity}</td>
                      <td className="font-bold">₹{row.totalSales?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Products Report */}
      <div className="card mt-4">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} color="var(--badge-out-of-stock-color)" />
          {t('lowStockReport')}
        </h3>

        {lowStockProducts.length === 0 ? (
          <p className="empty-state">{t('allStockHealthy')}</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th>{t('category')}</th>
                  <th>{t('sellingPrice')}</th>
                  <th>{t('currentStock')}</th>
                  <th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((prod) => (
                  <tr key={prod._id}>
                    <td className="font-bold">{prod.name}</td>
                    <td>{prod.category}</td>
                    <td>₹{prod.sellingPrice || prod.price}</td>
                    <td className="font-bold">{prod.stock} {t('units')}</td>
                    <td>
                      <span className={`badge ${prod.stock === 0 ? 'badge-out-of-stock' : 'badge-low-stock'}`}>
                        {prod.stock === 0 ? t('outOfStock') : t('lowStock')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
