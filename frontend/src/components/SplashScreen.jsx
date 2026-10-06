import React, { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';

export default function SplashScreen({ onFinish }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      if (onFinish) onFinish();
      return;
    }

    // Start fade out after 1.1s
    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, 1100);

    // Unmount/finish after 1.4s (300ms fade transition)
    const timer2 = setTimeout(() => {
      if (onFinish) onFinish();
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div className={`splash-overlay ${fadeOut ? 'splash-fade-out' : ''}`}>
      <div className="splash-card">
        <div className="splash-icon-wrapper">
          <ShoppingBag size={38} color="#FFFFFF" className="splash-icon" />
        </div>

        <h1 className="splash-title">Retail Manager</h1>
        <div className="splash-badge">INVENTORY & SALES</div>
        <p className="splash-subtitle">Smart Sales & Inventory Management</p>

        <div className="splash-progress-track">
          <div className="splash-progress-fill" />
        </div>
      </div>
    </div>
  );
}
