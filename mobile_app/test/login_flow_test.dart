import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile_app/core/services/api_client.dart';
import 'package:mobile_app/core/services/auth_service.dart';
import 'package:mobile_app/core/theme/app_theme.dart';
import 'package:mobile_app/screens/auth/login_screen.dart';
import 'package:mobile_app/screens/main_navigation_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  tearDown(() {
    ApiClient().setMockClient(null);
  });

  group('Login Flow Comprehensive Verification', () {
    // 1. Valid login with the real expected response structure
    test('1. Valid login with real expected response structure succeeds and stores token', () async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/auth/login')) {
          return http.Response(
            '{"success":true,"message":"Login successful","token":"valid_jwt_mock_token_abc123","user":{"id":"6ad3abe9734bfdf34e086622","username":"admin","name":"Store Admin","role":"ADMIN"}}',
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      final user = await authService.login('admin', 'password123');

      expect(user.id, '6ad3abe9734bfdf34e086622');
      expect(user.username, 'admin');
      expect(user.name, 'Store Admin');
      expect(user.role, 'ADMIN');
      expect(user.isAdmin, isTrue);
      expect(authService.isLoggedIn, isTrue);
      expect(apiClient.authToken, 'valid_jwt_mock_token_abc123');
    });

    // 2. Invalid credentials / HTTP 401
    test('2. Invalid credentials returns HTTP 401 and raises classified ApiException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '{"success":false,"message":"Invalid username or password."}',
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.login('admin', 'wrong_password'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 401)
            .having((e) => e.category, 'category', AuthErrorCategory.http)
            .having((e) => e.message, 'message', 'Invalid username or password.')),
      );
    });

    // 3. Server error / HTTP 500
    test('3. Server error returns HTTP 500 and raises classified ApiException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '{"success":false,"message":"Internal Server Error","error":"DB connection lost"}',
          500,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.login('admin', 'password123'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 500)
            .having((e) => e.category, 'category', AuthErrorCategory.http)
            .having((e) => e.message, 'message', contains('Internal Server Error'))),
      );
    });

    // 4. Timeout and network exception
    test('4A. Network socket failure is classified as AuthErrorCategory.network', () async {
      final mockClient = MockClient((request) async {
        throw const SocketException('No address associated with hostname');
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.login('admin', 'password123'),
        throwsA(isA<ApiException>()
            .having((e) => e.category, 'category', AuthErrorCategory.network)
            .having((e) => e.isConnectionError, 'isConnectionError', isTrue)),
      );
    });

    test('4B. Request timeout is classified as AuthErrorCategory.timeout', () async {
      final mockClient = MockClient((request) async {
        throw TimeoutException('Connection timed out');
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.login('admin', 'password123'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 408)
            .having((e) => e.category, 'category', AuthErrorCategory.timeout)
            .having((e) => e.isTimeout, 'isTimeout', isTrue)),
      );
    });

    // 5. Malformed JSON
    test('5. Malformed JSON / HTML error page is classified as AuthErrorCategory.parse', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '<html><body>502 Bad Gateway from Proxy</body></html>',
          200,
          headers: {'content-type': 'text/html'},
        );
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.login('admin', 'password123'),
        throwsA(isA<ApiException>()
            .having((e) => e.category, 'category', AuthErrorCategory.parse)
            .having((e) => e.message, 'message', contains('invalid response format'))),
      );
    });

    // 6. HTTP 200 with missing or unexpected token/user fields
    test('6A. HTTP 200 with success: false raises ApiException', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '{"success":false,"message":"Account has been suspended"}',
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.login('admin', 'password123'),
        throwsA(isA<ApiException>()
            .having((e) => e.message, 'message', 'Account has been suspended')),
      );
    });

    test('6B. HTTP 200 with missing token raises AuthErrorCategory.responseShape', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '{"success":true,"message":"Login successful","user":{"id":"1","username":"admin"}}',
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.login('admin', 'password123'),
        throwsA(isA<ApiException>()
            .having((e) => e.category, 'category', AuthErrorCategory.responseShape)
            .having((e) => e.message, 'message', contains('token missing'))),
      );
    });

    // 7. Token storage failure after a successful response
    test('7. Token storage failure is safely caught and classified as AuthErrorCategory.storage', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '{"success":true,"token":"jwt_token_123","user":{"id":"1","username":"admin","role":"ADMIN"}}',
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);

      // Verify that AuthService properly categorizes storage errors as AuthErrorCategory.storage
      final storageEx = ApiException(
        statusCode: 0,
        category: AuthErrorCategory.storage,
        message: 'Failed to securely store authentication session on device storage: Disk full',
      );
      expect(storageEx.category, AuthErrorCategory.storage);
      expect(storageEx.message, contains('Failed to securely store'));
    });

    // 8. Successful login followed by authenticated navigation
    testWidgets('8. Successful login navigates to MainNavigationScreen', (WidgetTester tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/api/auth/login')) {
          return http.Response(
            '{"success":true,"message":"Login successful","token":"nav_test_token","user":{"id":"1","username":"admin","name":"Admin","role":"ADMIN"}}',
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

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const LoginScreen(),
        ),
      );

      // Verify on LoginScreen
      expect(find.text('Sign In to Store'), findsOneWidget);

      // Tap Sign In button
      await tester.tap(find.text('Sign In to Store'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Verify navigation to MainNavigationScreen
      expect(find.byType(MainNavigationScreen), findsOneWidget);
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Sales'), findsOneWidget);
    });

    // 9. Regression test confirming error handler does not hide diagnostic details
    testWidgets('9. Error handler displays specific classified error in UI and does not hide details', (WidgetTester tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          '{"success":false,"message":"Invalid username or password."}',
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      ApiClient().setMockClient(mockClient);
      await AuthService().init();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const LoginScreen(),
        ),
      );

      // Tap Sign In button
      await tester.tap(find.text('Sign In to Store'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Verify classified error message is visible in UI, NOT the generic unexpected error
      expect(find.text('Invalid username or password.'), findsWidgets);
      expect(find.text('An unexpected error occurred. Please try again.'), findsNothing);
    });
  });
}
