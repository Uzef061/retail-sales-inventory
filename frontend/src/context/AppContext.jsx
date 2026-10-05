import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'light';
  });

  // Language State
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('app_lang') || 'en';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  // Translation Helper Function t("key", { count: 5 })
  const t = (key, params = {}) => {
    const dict = translations[lang] || translations.en;
    let str = dict[key] || translations.en[key] || key;
    
    // Replace parameters like {count}, {name}, {term}, {stock}
    Object.keys(params).forEach(p => {
      str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
    return str;
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, setLang, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
