import 'package:flutter/material.dart';
import 'core/services/auth_service.dart';
import 'core/theme/app_theme.dart';
import 'screens/auth/login_screen.dart';
import 'screens/main_navigation_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final authService = AuthService();
  await authService.init();

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
      home: authService.isLoggedIn
          ? const MainNavigationScreen()
          : const LoginScreen(),
    );
  }
}
