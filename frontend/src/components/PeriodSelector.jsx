import React from 'react';
import { Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function PeriodSelector({ period = '7days', onChange }) {
  const { t } = useApp();

  const options = [
    { value: '7days', label: t('period7days') || 'Last 7 Days' },
    { value: 'thisWeek', label: t('periodThisWeek') || 'This Week' },
    { value: 'prevWeek', label: t('periodPrevWeek') || 'Previous Week' },
    { value: '30days', label: t('period30days') || 'Last 30 Days' },
    { value: '90days', label: t('period90days') || 'Last 90 Days' },
    { value: 'all', label: t('periodAll') || 'All Time' }
  ];

  return (
    <div className="period-selector-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <Calendar size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
      <select
        className="form-select"
        value={period}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '0.35rem 0.65rem',
          fontSize: '0.825rem',
          fontWeight: 600,
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--input-bg)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          minHeight: '34px',
          width: 'auto'
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
