class ApiConfig {
  static const String defaultLiveUrl = 'https://retail-sales-inventory-1.onrender.com';
  static const String defaultLocalUrl = 'http://10.0.2.2:5000'; // Android emulator to host
  static const String defaultLanUrl = 'http://localhost:5000';

  static const String prefsBaseUrlKey = 'api_base_url';
  static const String prefsTokenKey = 'auth_token';
  static const String prefsUserKey = 'auth_user';

  // Endpoint paths
  static const String authLogin = '/api/auth/login';
  static const String authMe = '/api/auth/me';
  static const String dashboard = '/api/dashboard';
  static const String products = '/api/products';
  static const String sales = '/api/sales';
  static const String purchases = '/api/purchases';
  static const String customers = '/api/customers';
  static const String suppliers = '/api/suppliers';
  static const String profitLoss = '/api/profit-loss';

  // Generous request timeout for free Render cloud cold starts
  static const Duration timeoutDuration = Duration(seconds: 45);
}
