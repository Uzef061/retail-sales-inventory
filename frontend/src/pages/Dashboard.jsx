import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Package,
  Boxes,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Sparkles,
  TrendingUp,
  PackagePlus,
  Plus,
  PackageCheck,
  BarChart3,
  Truck,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
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
  const [activityTab, setActivityTab] = useState('sales'); // 'sales' | 'purchases'
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
    todaysSalesCount = 0,
    lowStockCount = 0,
    netProfit = 0,
    recentSales = [],
    recentPurchases = [],
    lowStockProducts = [],
    salesChart = [],
    insights = []
  } = data || {};

  return (
    <div className="page-wrapper">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">{t('dashboardTitle') || 'Store Overview'}</h1>
          <p className="page-subtitle">
            Welcome back! Here is your business activity and daily performance overview.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/sales" className="btn btn-primary">
            <ShoppingCart size={16} />
            {t('newSale') || '+ New Sale'}
          </Link>
        </div>
      </div>

      {/* Prominent Quick Actions Bar (Karobar-inspired simple daily actions) */}
      <div className="karobar-quick-actions">
        <Link to="/sales" className="quick-action-tile action-sale">
          <div className="quick-action-icon-wrapper">
            <ShoppingCart size={20} />
          </div>
          <div className="quick-action-content">
            <div className="quick-action-title">+ Add Sale</div>
            <div className="quick-action-subtitle">Fast POS billing & bill print</div>
          </div>
          <ArrowUpRight size={16} className="quick-action-arrow" />
        </Link>

        <Link to="/purchases" className="quick-action-tile action-purchase">
          <div className="quick-action-icon-wrapper">
            <PackageCheck size={20} />
          </div>
          <div className="quick-action-content">
            <div className="quick-action-title">+ Add Purchase</div>
            <div className="quick-action-subtitle">Restock inventory from supplier</div>
          </div>
          <ArrowUpRight size={16} className="quick-action-arrow" />
        </Link>

        <Link to="/inventory" className="quick-action-tile action-product">
          <div className="quick-action-icon-wrapper">
            <Plus size={20} />
          </div>
          <div className="quick-action-content">
            <div className="quick-action-title">+ Add Product</div>
            <div className="quick-action-subtitle">Add or edit catalog items</div>
          </div>
          <ArrowUpRight size={16} className="quick-action-arrow" />
        </Link>

        <Link to="/profit-loss" className="quick-action-tile action-reports">
          <div className="quick-action-icon-wrapper">
            <TrendingUp size={20} />
          </div>
          <div className="quick-action-content">
            <div className="quick-action-title">View Reports</div>
            <div className="quick-action-subtitle">Daily profit & financial summary</div>
          </div>
          <ArrowUpRight size={16} className="quick-action-arrow" />
        </Link>
      </div>

      {/* Business Insights Banner */}
      {Array.isArray(insights) && insights.length > 0 && (
        <div className="insights-banner" style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="insights-header">
            <Sparkles size={18} className="sparkle-icon" />
            <span className="insights-title">Smart Business Insights</span>
          </div>
          <div className="insights-list">
            {insights.map((insight, idx) => {
              if (!insight) return null;
              const isObj = typeof insight === 'object';
              const icon = isObj ? insight.icon : null;
              const message = isObj ? (insight.message || insight.text || '') : String(insight);

              if (!message) return null;

              return (
                <div key={idx} className="insight-pill">
                  {icon && <span className="insight-icon" style={{ marginRight: '0.4rem' }}>{icon}</span>}
                  <span className="insight-text">{message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: '1.5rem' }}>
        <KPICard
          label={t('todaysSales') || "Today's Sales"}
          value={`₹${todaysSales.toLocaleString()}`}
          subtext={`${todaysSalesCount} completed ${todaysSalesCount === 1 ? 'sale' : 'sales'} today`}
          icon={ShoppingCart}
          color="var(--badge-in-stock-color)"
        />
        <KPICard
          label={t('lowStockProductsCount') || "Low Stock Products"}
          value={lowStockCount}
          subtext={lowStockCount > 0 ? `${lowStockCount} items need restock` : 'All items in stock'}
          icon={AlertTriangle}
          color={lowStockCount > 0 ? 'var(--badge-out-of-stock-color)' : 'var(--badge-in-stock-color)'}
        />
        <KPICard
          label={t('totalProducts') || "Total Products"}
          value={totalProducts}
          subtext="Active in catalog"
          icon={Package}
          color="var(--primary)"
        />
        <KPICard
          label={t('totalStock') || "Total Stock"}
          value={totalStock.toLocaleString()}
          subtext="Units in inventory"
          icon={Boxes}
          color="var(--secondary)"
        />
        <KPICard
          label={t('netProfit') || "Period Profit"}
          value={`₹${netProfit.toLocaleString()}`}
          subtext={data?.label || 'Selected period'}
          icon={DollarSign}
          color="var(--primary)"
        />
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Main Column: Sales Chart & Recent Transactions (Sales & Purchases) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Sales Chart Card */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <h3 className="card-title" style={{ margin: 0 }}>
                {t('weeklySalesTrend') || 'Sales Performance Trend'}
              </h3>
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

          {/* Recent Activity Card: Toggle between Recent Sales & Recent Purchases */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.1rem',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activityTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActivityTab('sales')}
                  style={{ borderRadius: '20px', padding: '0.35rem 0.85rem' }}
                >
                  Recent Sales ({recentSales.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activityTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActivityTab('purchases')}
                  style={{ borderRadius: '20px', padding: '0.35rem 0.85rem' }}
                >
                  Recent Purchases ({recentPurchases.length})
                </button>
              </div>

              {activityTab === 'sales' ? (
                <Link
                  to="/sales"
                  style={{
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  {t('viewAll') || 'View All Sales'} <ArrowRight size={14} />
                </Link>
              ) : (
                <Link
                  to="/purchases/history"
                  style={{
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  View All Purchases <ArrowRight size={14} />
                </Link>
              )}
            </div>

            {/* TAB 1: RECENT SALES */}
            {activityTab === 'sales' && (
              recentSales.length === 0 ? (
                <p className="empty-state">{t('noRecentSales') || 'No recent sales recorded yet.'}</p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice / Product</th>
                        <th>Customer</th>
                        <th>Qty</th>
                        <th>Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((sale) => (
                        <tr key={sale._id}>
                          <td className="font-bold">
                            <div>
                              {sale.invoiceNumber && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'block', fontWeight: 700 }}>
                                  {sale.invoiceNumber}
                                </span>
                              )}
                              <span>
                                {sale.items && sale.items.length > 0
                                  ? sale.items.map((i) => i.productName).join(', ')
                                  : sale.product?.name || 'Retail Item'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div>
                              <div>{sale.customer?.name || 'Walk-in Customer'}</div>
                              {sale.customer?.phone && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {sale.customer.phone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{sale.quantity || (sale.items ? sale.items.reduce((s, i) => s + i.quantity, 0) : 1)}</td>
                          <td className="font-bold" style={{ color: 'var(--badge-in-stock-color)' }}>
                            ₹{(sale.grandTotal || sale.totalAmount)?.toLocaleString()}
                          </td>
                          <td className="text-muted" style={{ fontSize: '0.82rem' }}>
                            {new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* TAB 2: RECENT PURCHASES / RESTOCK */}
            {activityTab === 'purchases' && (
              recentPurchases.length === 0 ? (
                <p className="empty-state">No recent restock purchase orders recorded yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Restocked Product</th>
                        <th>Supplier</th>
                        <th>Units</th>
                        <th>Cost Price</th>
                        <th>Total Cost</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPurchases.map((po) => (
                        <tr key={po._id}>
                          <td className="font-bold">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Package size={15} color="var(--primary)" />
                              <span>{po.product?.name || 'Product'}</span>
                            </div>
                          </td>
                          <td>
                            {po.supplier?.name ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Truck size={14} color="var(--text-muted)" />
                                <span>{po.supplier.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted">Direct / Wholesale</span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-in-stock">+{po.quantity} units</span>
                          </td>
                          <td>₹{po.costPrice?.toLocaleString()}</td>
                          <td className="font-bold">
                            ₹{po.totalCost?.toLocaleString()}
                          </td>
                          <td className="text-muted" style={{ fontSize: '0.82rem' }}>
                            {new Date(po.purchaseDate || po.createdAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* Side Column: Low Stock Alerts & Quick Restock Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}
            >
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="var(--primary)" />
                {t('lowStockAlert') || 'Low Stock Alert'}
              </h3>
              <Link
                to="/inventory"
                style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Inventory →
              </Link>
            </div>

            {lowStockProducts.length === 0 ? (
              <p className="empty-state">{t('allStockHealthy') || 'All inventory stock levels are healthy.'}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {lowStockProducts.slice(0, 6).map((prod) => {
                  let badgeClass = 'badge-low-stock';
                  let statusText = t('lowStock') || 'Low Stock';
                  if (prod.stock === 0) {
                    badgeClass = 'badge-out-of-stock';
                    statusText = t('outOfStock') || 'Out of Stock';
                  }

                  return (
                    <div
                      key={prod._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
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
                          {prod.stock} {t('units') || 'units'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card text-center p-4">
            <PackagePlus size={32} className="mx-auto text-primary mb-2" />
            <h4 className="fw-700 mb-1">Restock Supplies</h4>
            <p className="text-sm muted-text mb-3">
              Order new batch from wholesale suppliers and automatically update inventory quantities.
            </p>
            <Link to="/purchases" className="btn btn-primary w-full justify-center">
              + New Purchase Order
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .karobar-quick-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .quick-action-tile {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 1rem 1.15rem;
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          text-decoration: none;
          color: var(--text-main);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          position: relative;
        }

        .quick-action-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.07);
          border-color: var(--primary);
        }

        .quick-action-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .action-sale .quick-action-icon-wrapper {
          background-color: rgba(46, 125, 50, 0.12);
          color: #2e7d32;
        }

        .action-purchase .quick-action-icon-wrapper {
          background-color: rgba(2, 136, 209, 0.12);
          color: #0288d1;
        }

        .action-product .quick-action-icon-wrapper {
          background-color: rgba(201, 106, 61, 0.14);
          color: var(--primary);
        }

        .action-reports .quick-action-icon-wrapper {
          background-color: rgba(123, 31, 162, 0.12);
          color: #7b1fa2;
        }

        .quick-action-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        .quick-action-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-main);
        }

        .quick-action-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 0.1rem;
        }

        .quick-action-arrow {
          color: var(--text-muted);
          opacity: 0.6;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        .quick-action-tile:hover .quick-action-arrow {
          opacity: 1;
          color: var(--primary);
          transform: translate(2px, -2px);
        }

        .insights-banner {
          background: linear-gradient(135deg, rgba(201, 106, 61, 0.12), rgba(201, 106, 61, 0.04));
          border: 1px solid rgba(201, 106, 61, 0.3);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
        }

        .insights-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .sparkle-icon {
          color: var(--primary);
        }

        .insights-title {
          font-weight: 700;
          font-size: 1rem;
          color: var(--primary);
        }

        .insights-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .insight-pill {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          padding: 0.4rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  );
}
