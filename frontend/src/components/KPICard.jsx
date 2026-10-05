import React from 'react';

export default function KPICard({ label, value, icon: Icon, color = 'var(--primary)' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon-wrapper" style={{ color: color, backgroundColor: `rgba(${hexToRgb(color)}, 0.12)` }}>
        {Icon && <Icon size={24} />}
      </div>
      <div className="kpi-info">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
      </div>
    </div>
  );
}

// Simple helper for RGB conversion of variable/hex
function hexToRgb(hex) {
  if (hex.startsWith('var')) return '201, 106, 61';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}
