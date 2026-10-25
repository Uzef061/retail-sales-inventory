/**
 * Currency configuration and helper for Karobiz.
 * Supports Nepalese Rupee (NPR / रू), Indian Rupee (INR / ₹), Pakistani Rupee (PKR / Rs.),
 * US Dollar (USD / $), Euro (EUR / €), British Pound (GBP / £), UAE Dirham (AED), Saudi Riyal (SAR).
 */

const SUPPORTED_CURRENCIES = {
  NPR: { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू', aliases: ['रू', 'NPR', 'NRs'] },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', aliases: ['₹', 'INR', 'Rs'] },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs.', aliases: ['₨', 'PKR', 'Rs.'] },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', aliases: ['$', 'USD'] },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', aliases: ['€', 'EUR'] },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', aliases: ['£', 'GBP'] },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', aliases: ['AED', 'د.إ'] },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', aliases: ['SAR', '﷼'] }
};

const getCurrencyByCodeOrSymbol = (value) => {
  if (!value) return SUPPORTED_CURRENCIES.INR;
  const clean = String(value).trim().toUpperCase();

  // Direct match by key
  if (SUPPORTED_CURRENCIES[clean]) {
    return SUPPORTED_CURRENCIES[clean];
  }

  // Match by alias or symbol
  for (const curr of Object.values(SUPPORTED_CURRENCIES)) {
    if (curr.symbol === value.trim() || curr.aliases.includes(value.trim()) || curr.aliases.includes(clean)) {
      return curr;
    }
  }

  // Default fallback preserving input if unrecognized
  return { code: clean, name: clean, symbol: value.trim(), aliases: [value.trim()] };
};

const isValidCurrency = (val) => {
  if (!val || typeof val !== 'string') return false;
  const clean = val.trim().toUpperCase();
  if (SUPPORTED_CURRENCIES[clean]) return true;
  for (const curr of Object.values(SUPPORTED_CURRENCIES)) {
    if (curr.symbol === val.trim() || curr.aliases.includes(val.trim()) || curr.aliases.includes(clean)) {
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
