import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, User, Lock, Eye, EyeOff, KeyRound, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authError, setAuthError } = useAuth();
  const { t, theme, toggleTheme } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setAuthError('Please enter both username and password.');
      return;
    }

    try {
      setSubmitting(true);
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      // Error handled by AuthContext setAuthError
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoUsername, demoPassword) => {
    setUsername(demoUsername);
    setPassword(demoPassword);
    setAuthError(null);
    try {
      setSubmitting(true);
      await login(demoUsername, demoPassword);
      navigate(from, { replace: true });
    } catch (err) {
      // Handled
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="brand-icon-wrapper">
            <Store size={32} className="brand-icon" />
          </div>
          <h1 className="login-brand-title">{t('appName') || 'Retail Manager'}</h1>
          <p className="login-brand-subtitle">{t('subTitle') || 'Inventory & Sales Management'}</p>
        </div>

        <div className="login-divider" />

        {/* Login Form Header */}
        <div className="form-header">
          <h2>Sign in to continue</h2>
          <p className="muted-text text-sm">Enter your credentials to access store workspace</p>
        </div>

        {authError && (
          <div className="auth-error-banner">
            <AlertCircle size={16} />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Username / Email</label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                type="text"
                className="form-control"
                placeholder="e.g. admin or cashier"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (authError) setAuthError(null);
                }}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary submit-login-btn"
            disabled={submitting}
          >
            {submitting ? (
              'Authenticating...'
            ) : (
              <>
                Sign In <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Demo Quick Login Helper (For BTech Viva Demo) */}
        <div className="demo-accounts-box">
          <div className="demo-header">
            <KeyRound size={15} className="demo-icon" />
            <span>Demo Project Quick Login</span>
          </div>
          <div className="demo-buttons-grid">
            <button
              type="button"
              className="demo-login-btn admin-demo"
              onClick={() => handleDemoLogin('admin', 'password123')}
              disabled={submitting}
            >
              <ShieldCheck size={14} />
              <div>
                <div className="demo-role font-bold">Admin Account</div>
                <div className="demo-creds">admin / password123</div>
              </div>
            </button>

            <button
              type="button"
              className="demo-login-btn cashier-demo"
              onClick={() => handleDemoLogin('cashier', 'password123')}
              disabled={submitting}
            >
              <User size={14} />
              <div>
                <div className="demo-role font-bold">Cashier Account</div>
                <div className="demo-creds">cashier / password123</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .login-page-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-main, #faf8f5);
          padding: 1.5rem;
        }

        .login-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border-color, #e2d9cf);
          border-radius: var(--radius-md, 10px);
          width: 420px;
          max-width: 100%;
          padding: 2rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }

        .login-brand-header {
          text-align: center;
        }

        .brand-icon-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background-color: rgba(201, 106, 61, 0.12);
          border-radius: 50%;
          margin-bottom: 0.75rem;
        }

        .brand-icon {
          color: var(--primary, #c96a3d);
        }

        .login-brand-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--text-main, #2d2623);
          margin: 0;
        }

        .login-brand-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted, #786d65);
          margin-top: 0.2rem;
        }

        .login-divider {
          height: 1px;
          background-color: var(--border-color, #e2d9cf);
          margin: 1.25rem 0;
        }

        .form-header {
          margin-bottom: 1.25rem;
        }

        .form-header h2 {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0 0 0.2rem 0;
        }

        .auth-error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: rgba(220, 53, 69, 0.12);
          border: 1px solid rgba(220, 53, 69, 0.3);
          color: #dc3545;
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-sm, 6px);
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--text-muted, #786d65);
          pointer-events: none;
        }

        .input-with-icon .form-control {
          padding-left: 2.3rem;
          padding-right: 2.3rem;
          width: 100%;
        }

        .toggle-password-btn {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: var(--text-muted, #786d65);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0.2rem;
        }

        .submit-login-btn {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 0.95rem;
          font-weight: 700;
          margin-top: 0.5rem;
        }

        .demo-accounts-box {
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px dashed var(--border-color, #e2d9cf);
        }

        .demo-header {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--primary, #c96a3d);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.75rem;
        }

        .demo-buttons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .demo-login-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: var(--input-bg, #f5f1ea);
          border: 1px solid var(--border-color, #e2d9cf);
          padding: 0.6rem 0.75rem;
          border-radius: var(--radius-sm, 6px);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .demo-login-btn:hover {
          border-color: var(--primary, #c96a3d);
          background-color: rgba(201, 106, 61, 0.08);
        }

        .demo-role {
          font-size: 0.8rem;
          color: var(--text-main, #2d2623);
        }

        .demo-creds {
          font-size: 0.7rem;
          color: var(--text-muted, #786d65);
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}
