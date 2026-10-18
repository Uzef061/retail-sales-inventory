import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import SmartInventory from './pages/SmartInventory';
import Reports from './pages/Reports';
import ProfitLoss from './pages/ProfitLoss';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import SplashScreen from './components/SplashScreen';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  return (
    <AuthProvider>
      <AppProvider>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="app-container">
                    <Sidebar />
                    <main className="main-content">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/inventory" element={<Inventory />} />
                        <Route path="/sales" element={<Sales defaultTab="new" />} />
                        <Route path="/sales/new" element={<Sales defaultTab="new" />} />
                        <Route path="/sales/history" element={<Sales defaultTab="history" />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/suppliers" element={<Suppliers />} />
                        <Route path="/purchases" element={<Purchases defaultTab="new" />} />
                        <Route path="/purchases/new" element={<Purchases defaultTab="new" />} />
                        <Route path="/purchases/history" element={<Purchases defaultTab="history" />} />
                        <Route path="/smart-inventory" element={<SmartInventory />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/profit-loss" element={<ProfitLoss />} />
                      </Routes>
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AppProvider>
    </AuthProvider>
  );
}
