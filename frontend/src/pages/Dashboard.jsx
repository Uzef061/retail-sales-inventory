import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Package, Boxes, ShoppingCart, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import KPICard from '../components/KPICard';
import SalesChart from '../components/SalesChart';
import PeriodNavigator from '../components/PeriodNavigator';
import { useApp } from '../context/AppContext';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('week');
  const [refDate, setRefDate] = useState(new Date());
  const { t } = useApp();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/dashboard', {
        params: { mode, refDate: refDate.toISOString() }
      });
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch dashboard data. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (direction) => {
    const newDate = new Date(refDate);
    if (mode === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else if (mode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (mode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }
    setRefDate(newDate);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [mode, refDate]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">Loading dashboard overview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="card text-center" style={{ padding: '2rem' }}>
          <p style={{ color: 'var(--primary)', fontWeight: 600 }}>{error}</p>
          <button className="btn btn-primary mt-4" onClick={fetchDashboardData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    totalProducts = 0,
    totalStock = 0,
    todaysSales = 0,
    lowStockCount = 0,
    netProfit = 0,
    recentSales = [],
    lowStockProducts = [],
    salesChart = []
  } = data || {};

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboardTitle')}</h1>
          <p className="page-subtitle">{t('dashboardSubtitle')}</p>
        </div>
        <Link to="/sales" className="btn btn-primary">
          <ShoppingCart size={16} />
          {t('newSale')}
        </Link>
      </div>

      {/* KPI Cards Grid - Now 5 KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KPICard
          label={t('totalProducts')}
          value={totalProducts}
          icon={Package}
          color="var(--primary)"
        />
        <KPICard
          label={t('totalStock')}
          value={totalStock}
          icon={Boxes}
          color="var(--secondary)"
        />
        <KPICard
          label={t('todaysSales')}
          value={`₹${todaysSales.toLocaleString()}`}
          icon={ShoppingCart}
          color="var(--badge-in-stock-color)"
        />
        <KPICard
          label={t('lowStockProductsCount')}
          value={lowStockCount}
          icon={AlertTriangle}
          color={lowStockCount > 0 ? 'var(--badge-out-of-stock-color)' : 'var(--badge-in-stock-color)'}
        />
        <KPICard
          label={t('netProfit')}
          value={`₹${netProfit.toLocaleString()}`}
          icon={DollarSign}
          color="var(--primary)"
        />
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Main Column: Sales Chart & Recent Sales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Sales Chart Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('weeklySalesTrend')}</h3>
              <PeriodNavigator
                mode={mode}
                label={data?.label}
                onModeChange={(newMode) => {
                  setMode(newMode);
                  setRefDate(new Date());
                }}
                onNavigate={handleNavigate}
              />
            </div>
            <div className="responsive-scroll-container">
              <SalesChart data={salesChart} />
            </div>
          </div>

          {/* Recent Sales Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('recentSales')}</h3>
              <Link to="/sales" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {t('viewAll')} <ArrowRight size={14} />
              </Link>
            </div>

            {recentSales.length === 0 ? (
              <p className="empty-state">{t('noRecentSales')}</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('product')}</th>
                      <th>{t('customer')}</th>
                      <th>{t('qty')}</th>
                      <th>{t('amount')}</th>
                      <th>{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale) => (
                      <tr key={sale._id}>
                        <td className="font-bold">{sale.product?.name || 'Deleted Product'}</td>
                        <td>{sale.customer?.name || 'Walk-in'}</td>
                        <td>{sale.quantity}</td>
                        <td className="font-bold">₹{sale.totalAmount?.toLocaleString()}</td>
                        <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {new Date(sale.saleDate).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Side Column: Low Stock Alerts */}
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('lowStockAlert')}</h3>
              <Link to="/inventory" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                {t('inventory')}
              </Link>
            </div>

            {lowStockProducts.length === 0 ? (
              <p className="empty-state">{t('allStockHealthy')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {lowStockProducts.map((prod) => {
                  let badgeClass = 'badge-low-stock';
                  let statusText = t('lowStock');
                  if (prod.stock === 0) {
                    badgeClass = 'badge-out-of-stock';
                    statusText = t('outOfStock');
                  }

                  return (
                    <div
                      key={prod._id}
                      style={{
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--input-bg)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{prod.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{prod.category}</div>
                      </div>
                      <div className="text-right">
                        <span className={`badge ${badgeClass}`}>{statusText}</span>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '0.2rem' }}>
                          {prod.stock} {t('units')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
