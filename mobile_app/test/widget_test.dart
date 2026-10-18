import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/theme/app_theme.dart';
import 'package:mobile_app/screens/auth/login_screen.dart';
import 'package:mobile_app/screens/main_navigation_screen.dart';

void main() {
  testWidgets('LoginScreen smoke test - renders form and quick autofills', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: const LoginScreen(),
      ),
    );

    // Verify title and description
    expect(find.text('Retail Sales & Inventory'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Sign In to Store'), findsOneWidget);

    // Verify demo chips
    expect(find.text('Admin'), findsOneWidget);
    expect(find.text('Cashier'), findsOneWidget);

    // Verify username and password fields exist
    expect(find.byType(TextFormField), findsNWidgets(2));
  });

  testWidgets('MainNavigationScreen smoke test - renders 5 bottom tabs', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: const MainNavigationScreen(),
      ),
    );

    // Verify bottom navigation bar has 5 tabs
    expect(find.byType(BottomNavigationBar), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Sales'), findsOneWidget);
    expect(find.text('Stock'), findsOneWidget);
    expect(find.text('Parties'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
  });
}
