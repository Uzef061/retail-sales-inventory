class ApiConfig {
  static const String defaultLiveUrl = 'https://retail-sales-inventory-1.onrender.com';
  static const String defaultLocalUrl = 'http://10.0.2.2:5000'; // Android emulator to host
  static const String defaultLanUrl = 'http://localhost:5000';

  // Google OAuth Web Client ID (from Google Cloud Console)
  // Required on Android to obtain an OpenID Connect ID token for backend server verification
  static String get googleServerClientId => const String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  ).trim();

  static const String prefsBaseUrlKey = 'api_base_url';
  static const String prefsTokenKey = 'auth_token';
  static const String prefsUserKey = 'auth_user';
  static const String prefsOnboardingKey = 'has_completed_onboarding';

  // Endpoint paths
  static const String authLogin = '/api/auth/login';
  static const String authGoogle = '/api/auth/google';
  static const String authMe = '/api/auth/me';
  static const String authOnboarding = '/api/auth/onboarding';
  static const String dashboard = '/api/dashboard';
  static const String products = '/api/products';
  static const String sales = '/api/sales';
  static const String purchases = '/api/purchases';
  static const String customers = '/api/customers';
  static const String suppliers = '/api/suppliers';
  static const String profitLoss = '/api/profit-loss';
  static const String businessProfile = '/api/business-profile';
  static const String payments = '/api/payments';
  static const String paymentsSummary = '/api/payments/summary';
  static const String reminders = '/api/reminders';
  static const String notes = '/api/notes';
  static const String notifications = '/api/notifications';
  static const String reports = '/api/reports';
  static const String ledger = '/api/ledger';

  // Generous request timeout for free Render cloud cold starts
  static const Duration timeoutDuration = Duration(seconds: 45);
}
