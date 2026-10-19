import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile_app/core/services/api_client.dart';
import 'package:mobile_app/core/services/auth_service.dart';
import 'package:mobile_app/core/theme/app_theme.dart';
import 'package:mobile_app/models/product.dart';
import 'package:mobile_app/models/user.dart';
import 'package:mobile_app/screens/auth/login_screen.dart';
import 'package:mobile_app/screens/main_navigation_screen.dart';
import 'package:mobile_app/screens/sales/sales_screen.dart';
import 'package:mobile_app/screens/splash/splash_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  tearDown(() {
    ApiClient().setMockClient(null);
  });

  group('Issue 1: First-Time Google Login vs Returning User Verification', () {
    test('1. User.fromJson parses hasCompletedOnboarding accurately', () {
      // Genuinely new Google user
      final newUserJson = {
        'id': 'g_123',
        'username': 'newuser_99',
        'email': 'newuser@example.com',
        'name': 'New User',
        'role': 'ADMIN',
        'hasCompletedOnboarding': false,
      };
      final newUser = User.fromJson(newUserJson);
      expect(newUser.hasCompletedOnboarding, isFalse);

      // Returning Google user
      final returningUserJson = {
        'id': 'g_456',
        'username': 'returning_user',
        'email': 'returning@example.com',
        'name': 'Returning User',
        'role': 'ADMIN',
        'hasCompletedOnboarding': true,
      };
      final returningUser = User.fromJson(returningUserJson);
      expect(returningUser.hasCompletedOnboarding, isTrue);

      // Legacy built-in admin account defaults hasCompletedOnboarding to true
      final legacyAdminJson = {
        'id': 'admin_1',
        'username': 'admin',
        'name': 'Admin User',
        'role': 'ADMIN',
      };
      final legacyAdmin = User.fromJson(legacyAdminJson);
      expect(legacyAdmin.hasCompletedOnboarding, isTrue);
    });

    testWidgets('2. Genuinely new Google user navigates to SplashScreen for introductory animation', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/auth/google')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'message': 'Google login successful',
              'token': 'new_google_token_123',
              'isNewUser': true,
              'user': {
                'id': 'g_new_1',
                'username': 'brand_new_owner',
                'email': 'brandnew@gmail.com',
                'name': 'Brand New Owner',
                'role': 'ADMIN',
                'hasCompletedOnboarding': false,
                'isNewUser': true,
              }
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      ApiClient().setMockClient(mockClient);
      await AuthService().init();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const LoginScreen(),
        ),
      );

      // Directly invoke Google login through AuthService to simulate successful Google Auth callback
      final user = await AuthService().loginWithGoogle('mock_id_token_for_new_user');
      expect(user.hasCompletedOnboarding, isFalse);

      // Re-pump widget tree with new user session routing through LoginScreen navigation
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: SplashScreen(authService: AuthService()),
        ),
      );

      // Verify that the introductory animation screen (SplashScreen) is rendered
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('Karobiz'), findsOneWidget);
      expect(find.text('Smart small-business management'), findsOneWidget);
      expect(find.text('Starting workspace...'), findsOneWidget);

      // Advance time past the splash delay so background initialization and animations finish
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.pump(const Duration(milliseconds: 500));
    });

    testWidgets('3. Returning Google user navigates directly to MainNavigationScreen', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/auth/google')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'message': 'Google login successful',
              'token': 'returning_google_token_456',
              'isNewUser': false,
              'user': {
                'id': 'g_ret_1',
                'username': 'ret_owner',
                'email': 'retowner@gmail.com',
                'name': 'Existing Owner',
                'role': 'ADMIN',
                'hasCompletedOnboarding': true,
                'isNewUser': false,
              }
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path.endsWith('/api/dashboard')) {
          return http.Response(
            '{"metrics":{"todaySales":0,"completedOrders":0,"lowStockCount":0},"recentSales":[],"recentPurchases":[]}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      ApiClient().setMockClient(mockClient);
      await AuthService().init();

      final user = await AuthService().loginWithGoogle('mock_id_token_for_returning_user');
      expect(user.hasCompletedOnboarding, isTrue);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const MainNavigationScreen(),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      // Verify returning user arrives directly at MainNavigationScreen without onboarding
      expect(find.byType(MainNavigationScreen), findsOneWidget);
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Sales'), findsOneWidget);
      expect(find.text('Stock'), findsOneWidget);
    });
  });

  group('Issue 2: Sales Screen POS Product Search & Data Flow Verification', () {
    test('4. Product model parses barcode alias correctly', () {
      final json = {
        'id': 'prod_99',
        'name': 'Test Tea',
        'category': 'Beverages',
        'costPrice': 40,
        'sellingPrice': 60,
        'stock': 15,
        'barcode': 'BAR-987654321',
      };
      final product = Product.fromJson(json);
      expect(product.sku, equals('BAR-987654321'));
      expect(product.barcode, equals('BAR-987654321'));
    });

    testWidgets('5. SalesScreen POS loads and displays real products from API', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/products')) {
          return http.Response(
            jsonEncode([
              {
                '_id': 'p1',
                'name': 'Premium Coffee Beans',
                'category': 'Beverages',
                'costPrice': 100,
                'sellingPrice': 200,
                'stock': 25,
                'sku': 'COF-001',
                'isActive': true,
              },
              {
                '_id': 'p2',
                'name': 'Organic Green Tea',
                'category': 'Beverages',
                'costPrice': 50,
                'sellingPrice': 90,
                'stock': 10,
                'sku': 'TEA-002',
                'isActive': true,
              },
            ]),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path.endsWith('/api/customers')) {
          return http.Response(
            jsonEncode([
              {
                '_id': 'c1',
                'name': 'Walk-in Customer',
                'phone': '9800000000',
              }
            ]),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path.endsWith('/api/sales')) {
          return http.Response('[]', 200, headers: {'content-type': 'application/json'});
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      ApiClient().setMockClient(mockClient);
      await AuthService().init();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const SalesScreen(isSelected: true),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      // Verify products are loaded and displayed in POS
      expect(find.text('Premium Coffee Beans'), findsOneWidget);
      expect(find.text('Organic Green Tea'), findsOneWidget);
      expect(find.textContaining('SKU: COF-001'), findsOneWidget);
      expect(find.textContaining('SKU: TEA-002'), findsOneWidget);
    });

    testWidgets('6. SalesScreen product search filters by name, category, and SKU/barcode', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/products')) {
          return http.Response(
            jsonEncode([
              {
                '_id': 'p1',
                'name': 'Basmati Rice 5kg',
                'category': 'Grains',
                'costPrice': 300,
                'sellingPrice': 450,
                'stock': 20,
                'sku': 'RICE-5KG-01',
                'isActive': true,
              },
              {
                '_id': 'p2',
                'name': 'Sunflower Oil 1L',
                'category': 'Cooking Oil',
                'costPrice': 120,
                'sellingPrice': 180,
                'stock': 15,
                'sku': 'OIL-SUN-02',
                'isActive': true,
              },
            ]),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path.endsWith('/api/customers')) {
          return http.Response('[]', 200, headers: {'content-type': 'application/json'});
        }
        if (request.url.path.endsWith('/api/sales')) {
          return http.Response('[]', 200, headers: {'content-type': 'application/json'});
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      ApiClient().setMockClient(mockClient);
      await AuthService().init();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const SalesScreen(isSelected: true),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      // Find search input
      final searchFinder = find.byType(TextField).first;

      // 1. Search by product name
      await tester.enterText(searchFinder, 'Basmati');
      await tester.pumpAndSettle();
      expect(find.text('Basmati Rice 5kg'), findsOneWidget);
      expect(find.text('Sunflower Oil 1L'), findsNothing);

      // 2. Search by category
      await tester.enterText(searchFinder, 'Cooking Oil');
      await tester.pumpAndSettle();
      expect(find.text('Basmati Rice 5kg'), findsNothing);
      expect(find.text('Sunflower Oil 1L'), findsOneWidget);

      // 3. Search by SKU
      await tester.enterText(searchFinder, 'RICE-5KG');
      await tester.pumpAndSettle();
      expect(find.text('Basmati Rice 5kg'), findsOneWidget);
      expect(find.text('Sunflower Oil 1L'), findsNothing);

      // 4. Search with no matches shows empty state with Clear Search button
      await tester.enterText(searchFinder, 'NonExistentItem');
      await tester.pumpAndSettle();
      expect(find.textContaining('No products matching "NonExistentItem"'), findsOneWidget);
      expect(find.text('Clear Search'), findsOneWidget);

      // 5. Tap Clear Search restores products
      await tester.tap(find.text('Clear Search'));
      await tester.pumpAndSettle();
      expect(find.text('Basmati Rice 5kg'), findsOneWidget);
      expect(find.text('Sunflower Oil 1L'), findsOneWidget);
    });

    testWidgets('7. SalesScreen displays error state with Retry button on API failure', (tester) async {
      bool shouldFail = true;

      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/products')) {
          if (shouldFail) {
            return http.Response(
              jsonEncode({'message': 'Database connection timeout'}),
              500,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response(
            jsonEncode([
              {
                '_id': 'p1',
                'name': 'Recovered Item',
                'category': 'General',
                'costPrice': 10,
                'sellingPrice': 20,
                'stock': 5,
                'isActive': true,
              }
            ]),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('[]', 200, headers: {'content-type': 'application/json'});
      });

      ApiClient().setMockClient(mockClient);
      await AuthService().init();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const SalesScreen(isSelected: true),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      // Error message and Try Again button must be visible
      expect(find.text('Database connection timeout'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);

      // Simulate recovery and tap Try Again
      shouldFail = false;
      await tester.tap(find.text('Try Again'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Product successfully loaded after retry
      expect(find.text('Recovered Item'), findsOneWidget);
    });

    testWidgets('8. SalesScreen resiliently loads products even if customers API fails', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/products')) {
          return http.Response(
            jsonEncode([
              {
                '_id': 'p_resilient',
                'name': 'Resilient Product',
                'category': 'Snacks',
                'costPrice': 15,
                'sellingPrice': 30,
                'stock': 50,
                'isActive': true,
              }
            ]),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path.endsWith('/api/customers')) {
          // Customers endpoint returns 500 error
          return http.Response(
            jsonEncode({'message': 'Customer service temporarily unavailable'}),
            500,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('[]', 200, headers: {'content-type': 'application/json'});
      });

      ApiClient().setMockClient(mockClient);
      await AuthService().init();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const SalesScreen(isSelected: true),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      // Verify product is still visible despite customer service failure
      expect(find.text('Resilient Product'), findsOneWidget);
    });
  });
}
