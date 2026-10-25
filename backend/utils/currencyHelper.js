/**
 * Currency configuration and helper for Karobiz.
 * Supports Nepalese Rupee (NPR / रू), Indian Rupee (INR / ₹), Pakistani Rupee (PKR / Rs.),
 * US Dollar (USD / $), Euro (EUR / €), British Pound (GBP / £), UAE Dirham (AED), Saudi Riyal (SAR).
 */

const SUPPORTED_CURRENCIES = {
  NPR: {
    code: 'NPR',
    name: 'Nepalese Rupee',
    symbol: 'रू',
    aliases: [
      'रू',
      'NPR',
      'NRs',
      'NEPALESE RUPEE',
      'Nepalese Rupee',
      'Nepalese Rupee (NPR — रू)',
      'NEPALESE RUPEE (NPR — रू)',
      'Nepalese Rupee (NPR - रू)',
      'NEPALESE RUPEE (NPR - रू)',
      'NPR - Nepalese Rupee (रू)',
      'NPR - NEPALESE RUPEE (रू)',
      'NEPAL'
    ]
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    aliases: [
      '₹',
      'INR',
      'Rs',
      'Rs.',
      'INDIAN RUPEE',
      'Indian Rupee',
      'Indian Rupee (INR — ₹)',
      'INDIAN RUPEE (INR — ₹)',
      'Indian Rupee (INR - ₹)',
      'INR - Indian Rupee (₹)',
      'INDIA'
    ]
  },
  PKR: {
    code: 'PKR',
    name: 'Pakistani Rupee',
    symbol: 'Rs.',
    aliases: [
      '₨',
      'PKR',
      'Rs',
      'Rs.',
      'PAKISTANI RUPEE',
      'Pakistani Rupee',
      'Pakistani Rupee (PKR — Rs)',
      'PAKISTANI RUPEE (PKR — Rs)',
      'PKR - Pakistani Rupee (Rs)',
      'PAKISTAN'
    ]
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    aliases: [
      '$',
      'USD',
      'US DOLLAR',
      'US Dollar',
      'US Dollar (USD — $)',
      'USD - US Dollar ($)',
      'DOLLAR'
    ]
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    aliases: [
      '€',
      'EUR',
      'EURO',
      'Euro',
      'Euro (EUR — €)',
      'EUR - Euro (€)'
    ]
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    aliases: [
      '£',
      'GBP',
      'BRITISH POUND',
      'British Pound',
      'British Pound (GBP — £)',
      'GBP - British Pound (£)',
      'POUND'
    ]
  },
  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'AED',
    aliases: [
      'AED',
      'د.إ',
      'DIRHAM',
      'UAE Dirham',
      'UAE DIRHAM',
      'UAE Dirham (AED)'
    ]
  },
  SAR: {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: 'SAR',
    aliases: [
      'SAR',
      '﷼',
      'RIYAL',
      'Saudi Riyal',
      'SAUDI RIYAL',
      'Saudi Riyal (SAR)'
    ]
  }
};

const getCurrencyByCodeOrSymbol = (value) => {
  if (!value) return SUPPORTED_CURRENCIES.INR;
  const raw = String(value).trim();
  const upper = raw.toUpperCase();

  // 1. Direct match by code key (e.g. NPR, USD, INR)
  if (SUPPORTED_CURRENCIES[upper]) {
    return SUPPORTED_CURRENCIES[upper];
  }

  // 2. Exact match by symbol or alias
  for (const curr of Object.values(SUPPORTED_CURRENCIES)) {
    if (
      curr.symbol === raw ||
      curr.aliases.includes(raw) ||
      curr.aliases.some((a) => a.toUpperCase() === upper)
    ) {
      return curr;
    }
  }

  // 3. Substring matching (e.g. "Nepalese Rupee", "NPR", "रू")
  for (const curr of Object.values(SUPPORTED_CURRENCIES)) {
    if (
      raw.includes(curr.symbol) ||
      upper.includes(curr.code) ||
      upper.includes(curr.name.toUpperCase())
    ) {
      return curr;
    }
  }

  // Default fallback preserving input if unrecognized
  return { code: upper, name: raw, symbol: raw, aliases: [raw] };
};

const isValidCurrency = (val) => {
  if (!val || typeof val !== 'string') return false;
  const raw = val.trim();
  const upper = raw.toUpperCase();
  if (SUPPORTED_CURRENCIES[upper]) return true;
  for (const curr of Object.values(SUPPORTED_CURRENCIES)) {
    if (
      curr.symbol === raw ||
      curr.aliases.includes(raw) ||
      curr.aliases.some((a) => a.toUpperCase() === upper) ||
      raw.includes(curr.symbol) ||
      upper.includes(curr.code) ||
      upper.includes(curr.name.toUpperCase())
    ) {
      return true;
    }
  }
  return false;
};

const normalizeCurrency = (val) => getCurrencyByCodeOrSymbol(val);

const formatCurrency = (amount, codeOrSymbol = 'INR') => {
  const curr = getCurrencyByCodeOrSymbol(codeOrSymbol);
  const num = Number(amount) || 0;
  return `${curr.symbol}${num.toLocaleString()}`;
};

module.exports = {
  SUPPORTED_CURRENCIES,
  getCurrencyByCodeOrSymbol,
  normalizeCurrency,
  isValidCurrency,
  formatCurrency
};
