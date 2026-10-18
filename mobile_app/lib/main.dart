import 'package:flutter/material.dart';
import 'core/services/auth_service.dart';
import 'core/theme/app_theme.dart';
import 'screens/splash/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('Flutter Startup Error: ${details.exceptionAsString()}');
  };

  final authService = AuthService();
  try {
    await authService.init();
  } catch (e, stack) {
    debugPrint('Auth initialization warning: $e\n$stack');
  }

  runApp(RetailSalesApp(authService: authService));
}

class RetailSalesApp extends StatelessWidget {
  final AuthService authService;

  const RetailSalesApp({super.key, required this.authService});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Retail Sales & Inventory',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: SplashScreen(authService: authService),
    );
  }
}
