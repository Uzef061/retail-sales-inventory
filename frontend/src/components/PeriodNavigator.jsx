import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function PeriodNavigator({ mode = 'week', label, onModeChange, onNavigate }) {
  const { t } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const modes = [
    { value: 'week', label: t('modeWeek') || 'Week' },
    { value: 'month', label: t('modeMonth') || 'Month' },
    { value: 'year', label: t('modeYear') || 'Year' }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMode = modes.find((m) => m.value === mode) || modes[0];

  const prevText = mode === 'week' ? 'Previous Week' : mode === 'month' ? 'Previous Month' : 'Previous Year';
  const nextText = mode === 'week' ? 'Next Week' : mode === 'month' ? 'Next Month' : 'Next Year';

  return (
    <div className="period-nav-container">
      {/* Custom Mode Selector Dropdown (Replicating Language Selector Style) */}
      <div className="custom-period-dropdown-container" ref={dropdownRef}>
        <button
          type="button"
          className={`custom-period-trigger ${isOpen ? 'active-trigger' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          title="Select Reporting Period"
        >
          <Calendar size={15} className="custom-period-calendar-icon" />
          <span className="custom-period-prefix">Period:</span>
          <span className="custom-period-current-label">{currentMode.label}</span>
          <ChevronDown
            size={14}
            className={`custom-period-chevron ${isOpen ? 'chevron-rotated' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="custom-period-dropdown-menu">
            {modes.map((m) => {
              const isSelected = m.value === mode;
              return (
                <button
                  key={m.value}
                  type="button"
                  className={`custom-period-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onModeChange(m.value);
                    setIsOpen(false);
                  }}
                >
                  <span>{m.label}</span>
                  {isSelected && <Check size={14} className="custom-period-check" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Prev / Label / Next Navigation Controls */}
      <div className="period-nav-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm nav-arrow-btn"
          onClick={() => onNavigate(-1)}
          title={prevText}
        >
          <ChevronLeft size={16} />
          <span className="nav-arrow-text">{t('prev') || 'Previous'}</span>
        </button>

        <span className="period-display-label">
          {label || 'Loading...'}
        </span>

        <button
          type="button"
          className="btn btn-secondary btn-sm nav-arrow-btn"
          onClick={() => onNavigate(1)}
          title={nextText}
        >
          <span className="nav-arrow-text">{t('next') || 'Next'}</span>
          <ChevronRight size={16} />
        </button>
      </div>

      <style>{`
        .period-nav-container {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .custom-period-dropdown-container {
          position: relative;
          display: inline-block;
        }

        .custom-period-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background-color: var(--input-bg);
          border: 1px solid var(--border-color);
          padding: 0.45rem 0.75rem;
          border-radius: var(--radius-sm);
          color: var(--text-main);
          font-size: 0.85rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(47, 41, 37, 0.04);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          min-height: 38px;
          box-sizing: border-box;
        }

        .custom-period-trigger:hover,
        .custom-period-trigger.active-trigger {
          border-color: var(--primary);
          background-color: var(--table-header-bg);
          box-shadow: 0 3px 10px rgba(201, 106, 61, 0.15);
        }

        .custom-period-trigger.active-trigger {
          box-shadow: 0 0 0 3px rgba(201, 106, 61, 0.2);
        }

        .custom-period-calendar-icon {
          color: var(--primary);
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .custom-period-trigger:hover .custom-period-calendar-icon {
          transform: scale(1.1);
        }

        .custom-period-prefix {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .custom-period-current-label {
          font-weight: 700;
          color: var(--text-main);
        }

        .custom-period-chevron {
          color: var(--text-muted);
          flex-shrink: 0;
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .custom-period-trigger:hover .custom-period-chevron,
        .custom-period-trigger.active-trigger .custom-period-chevron {
          color: var(--primary);
        }

        .custom-period-chevron.chevron-rotated {
          transform: rotate(180deg);
        }

        .custom-period-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 140px;
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0.35rem;
          box-shadow: var(--shadow-hover), 0 8px 24px rgba(0, 0, 0, 0.14);
          z-index: 1050;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          animation: langDropFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .custom-period-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.55rem 0.75rem;
          font-size: 0.85rem;
          font-weight: 600;
          font-family: inherit;
          color: var(--text-main);
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .custom-period-item:hover {
          background-color: rgba(201, 106, 61, 0.1);
          color: var(--primary);
        }

        .custom-period-item.selected {
          background-color: rgba(201, 106, 61, 0.15);
          color: var(--primary);
          font-weight: 700;
        }

        .custom-period-check {
          color: var(--primary);
          flex-shrink: 0;
        }

        .period-nav-controls {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0.2rem 0.35rem;
          box-shadow: var(--shadow-subtle);
          max-width: 100%;
          flex-wrap: wrap;
          min-height: 38px;
          box-sizing: border-box;
        }

        .nav-arrow-btn {
          padding: 0.3rem 0.55rem;
          min-height: 32px;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-weight: 600;
        }

        .period-display-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-main);
          padding: 0 0.5rem;
          white-space: nowrap;
          text-align: center;
        }

        @media (max-width: 576px) {
          .period-nav-container {
            width: 100%;
            justify-content: space-between;
          }
          .custom-period-dropdown-container {
            width: 100%;
          }
          .custom-period-trigger {
            width: 100%;
            justify-content: space-between;
          }
          .period-nav-controls {
            width: 100%;
            justify-content: space-between;
          }
          .nav-arrow-text {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
