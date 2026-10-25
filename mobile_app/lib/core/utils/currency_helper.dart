import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CurrencyHelper {
  static const String _prefKey = 'app_business_currency';

  // Default is INR/₹ or whatever was previously configured
  static String _activeCode = 'INR';
  static String _activeSymbol = '₹';

  static const Map<String, Map<String, String>> _currencyMap = {
    'NPR': {'name': 'Nepalese Rupee', 'symbol': 'रू'},
    'INR': {'name': 'Indian Rupee', 'symbol': '₹'},
    'PKR': {'name': 'Pakistani Rupee', 'symbol': 'Rs.'},
    'USD': {'name': 'US Dollar', 'symbol': '\$'},
    'EUR': {'name': 'Euro', 'symbol': '€'},
    'GBP': {'name': 'British Pound', 'symbol': '£'},
    'AED': {'name': 'UAE Dirham', 'symbol': 'AED'},
    'SAR': {'name': 'Saudi Riyal', 'symbol': 'SAR'},
  };

  static String get code => _activeCode;
  static String get symbol => _activeSymbol;

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefKey);
      if (saved != null && saved.isNotEmpty) {
        setCurrency(saved, persist: false);
      }
    } catch (_) {}
  }

  static void setCurrency(String? codeOrSymbol, {bool persist = true}) {
    if (codeOrSymbol == null || codeOrSymbol.trim().isEmpty) return;
    final clean = codeOrSymbol.trim();

    // Check direct code match (e.g. NPR, USD, INR)
    final upper = clean.toUpperCase();
    if (_currencyMap.containsKey(upper)) {
      _activeCode = upper;
      _activeSymbol = _currencyMap[upper]!['symbol']!;
    } else if (clean == 'रू' || clean == 'NRs') {
      _activeCode = 'NPR';
      _activeSymbol = 'रू';
    } else if (clean == '₹') {
      _activeCode = 'INR';
      _activeSymbol = '₹';
    } else if (clean == 'Rs' || clean == 'Rs.' || clean == '₨') {
      _activeCode = 'PKR';
      _activeSymbol = 'Rs.';
    } else if (clean == '\$') {
      _activeCode = 'USD';
      _activeSymbol = '\$';
    } else if (clean == '€') {
      _activeCode = 'EUR';
      _activeSymbol = '€';
    } else if (clean == '£') {
      _activeCode = 'GBP';
      _activeSymbol = '£';
    } else {
      _activeCode = upper;
      _activeSymbol = clean;
    }

    if (persist) {
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString(_prefKey, _activeCode);
      }).catchError((_) {});
    }
  }

  /// Formats amount with active currency symbol
  static String format(num amount, {int decimals = 0}) {
    final formatter = NumberFormat.currency(
      symbol: symbol.endsWith('.') || symbol.length > 1 ? '$symbol ' : symbol,
      decimalDigits: decimals,
    );
    return formatter.format(amount);
  }
}
