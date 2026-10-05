import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  BarChart3,
  TrendingUp,
  Store,
  Menu,
  X,
  RotateCcw,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

export default function Sidebar({ onDataRefresh }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { theme, toggleTheme, lang, setLang, t } = useApp();

  const navItems = [
    { label: t('dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('products'), path: '/products', icon: Package },
    { label: t('inventory'), path: '/inventory', icon: Boxes },
    { label: t('sales'), path: '/sales', icon: ShoppingCart },
    { label: t('customers'), path: '/customers', icon: Users },
    { label: t('reports'), path: '/reports', icon: BarChart3 },
    { label: t('profitLoss'), path: '/profit-loss', icon: TrendingUp }
  ];

  const handleResetData = async () => {
    if (window.confirm('Reset demo dataset to initial state?')) {
      try {
        setResetting(true);
        await axios.post('/api/seed');
        alert('Database successfully reset to demo defaults!');
        if (onDataRefresh) onDataRefresh();
        window.location.reload();
      } catch (err) {
        alert('Failed to reset dataset');
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <>
      {/* Mobile Topbar Header */}
      <div className="mobile-header">
        <div className="brand-logo">
          <Store size={22} className="brand-icon" />
          <span>{t('appName')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="lang-select-wrapper" title="Select Language">
            <Globe size={14} className="lang-select-icon" />
            <select
              className="lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="en">English</option>
              <option value="ne">नेपाली</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Store size={26} className="brand-icon" />
          <div>
            <div className="brand-title">{t('appName')}</div>
            <div className="brand-subtitle">{t('subTitle')}</div>
          </div>
        </div>

        {/* Theme & Language Bar inside Sidebar Header */}
        <div className="sidebar-controls">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'light' ? (
              <>
                <Moon size={15} /> <span>{t('darkMode')}</span>
              </>
            ) : (
              <>
                <Sun size={15} /> <span>{t('lightMode')}</span>
              </>
            )}
          </button>

          <div className="lang-select-wrapper" title="Select Language">
            <Globe size={15} className="lang-select-icon" />
            <select
              className="lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="en">English</option>
              <option value="ne">नेपाली</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn btn-secondary btn-sm seed-btn"
            onClick={handleResetData}
            disabled={resetting}
            title="Re-seed initial demo dataset for viva"
          >
            <RotateCcw size={15} />
            <span>{resetting ? t('resetting') : t('resetData')}</span>
          </button>
        </div>
      </aside>

      <style>{`
        /* Sidebar Styling */
        .mobile-header {
          display: none;
          height: 60px;
          background-color: var(--card-bg);
          border-bottom: 1px solid var(--border-color);
          padding: 0 1.25rem;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-weight: 700;
          font-size: 1.1rem;
          color: var(--text-main);
        }

        .brand-icon {
          color: var(--primary);
        }

        .mobile-toggle {
          background: none;
          border: none;
          color: var(--text-main);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .sidebar {
          width: 240px;
          background-color: var(--card-bg);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 90;
          flex-shrink: 0;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .sidebar-brand {
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-title {
          font-weight: 700;
          font-size: 1.15rem;
          color: var(--text-main);
          line-height: 1.2;
        }

        .brand-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .sidebar-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem 0.85rem 1rem;
          border-bottom: 1px solid var(--border-color);
          gap: 0.4rem;
        }

        .sidebar-nav {
          padding: 1.25rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          flex: 1;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.7rem 1rem;
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 600;
          font-size: 0.9rem;
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
        }

        .nav-link:hover {
          color: var(--primary);
          background-color: rgba(201, 106, 61, 0.1);
        }

        .nav-link.active {
          color: var(--primary);
          background-color: rgba(201, 106, 61, 0.15);
        }

        .sidebar-footer {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border-color);
        }

        .seed-btn {
          width: 100%;
          justify-content: center;
        }

        .sidebar-overlay {
          display: none;
        }

        @media (max-width: 860px) {
          .mobile-header {
            display: flex;
          }

          .sidebar {
            position: fixed;
            top: 0;
            left: -260px;
            bottom: 0;
            height: 100vh;
            transition: left 0.25s ease;
            box-shadow: 4px 0 15px rgba(0,0,0,0.2);
          }

          .sidebar.sidebar-open {
            left: 0;
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 85;
          }
        }
      `}</style>
    </>
  );
}
