import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-main)'
      }}>
        <Store size={40} style={{ color: 'var(--primary)', marginBottom: '1rem', animation: 'spin 2s linear infinite' }} />
        <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Verifying Authentication Session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="page-wrapper text-center p-5">
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p className="muted-text mb-4">You do not have permission ({user.role}) to access this section.</p>
        <button className="btn btn-primary" onClick={() => window.history.back()}>
          Go Back
        </button>
      </div>
    );
  }

  return children;
}
