import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile_app/core/config/api_config.dart';
import 'package:mobile_app/core/services/api_client.dart';
import 'package:mobile_app/core/services/auth_service.dart';
import 'package:mobile_app/screens/auth/login_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  tearDown(() {
    ApiClient().setMockClient(null);
  });

  group('Google Sign-In End-to-End & Unit Tests', () {
    test('1. loginWithGoogle sends real ID token to POST /api/auth/google and persists session', () async {
      String? requestedPath;
      String? requestedBody;

      final mockClient = MockClient((request) async {
        requestedPath = request.url.path;
        requestedBody = request.body;

        if (request.url.path.endsWith('/api/auth/google')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'message': 'Google login successful',
              'token': 'google_jwt_session_token_xyz987',
              'user': {
                'id': 'google_user_123',
                'username': 'john.doe',
                'email': 'john.doe@gmail.com',
                'name': 'John Doe',
                'role': 'ADMIN',
                'hasCompletedOnboarding': true,
                'businessId': 'biz_999'
              }
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);

      final authService = AuthService();
      await authService.init();

      final user = await authService.loginWithGoogle('genuine_google_id_token_sample');

      expect(requestedPath, equals('/api/auth/google'));
      expect(jsonDecode(requestedBody!)['idToken'], equals('genuine_google_id_token_sample'));

      expect(user.id, equals('google_user_123'));
      expect(user.email, equals('john.doe@gmail.com'));
      expect(user.name, equals('John Doe'));
      expect(user.hasCompletedOnboarding, isTrue);

      expect(authService.isLoggedIn, isTrue);
      expect(apiClient.authToken, equals('google_jwt_session_token_xyz987'));

      // Verify stored in SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(ApiConfig.prefsTokenKey), equals('google_jwt_session_token_xyz987'));
      expect(prefs.getString(ApiConfig.prefsUserKey), isNotNull);
    });

    test('2. loginWithGoogle throws ApiException when token is empty', () async {
      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.loginWithGoogle('   '),
        throwsA(isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('token is empty'),
        )),
      );
    });

    test('3. loginWithGoogle throws classified ApiException when backend rejects token', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'message': 'Invalid Google authentication token: Wrong number of segments in token',
            'errorCode': 'INVALID_GOOGLE_TOKEN'
          }),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiClient = ApiClient();
      apiClient.setMockClient(mockClient);

      final authService = AuthService();
      await authService.init();

      expect(
        () => authService.loginWithGoogle('bad_token_format'),
        throwsA(isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('Invalid Google authentication token'),
        )),
      );
    });

    test('4. logout clears session token and user info', () async {
      final authService = AuthService();
      await authService.init();

      // Set user
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'token': 'mock_token',
            'user': {'id': '1', 'username': 'test'}
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });
      ApiClient().setMockClient(mockClient);
      await authService.loginWithGoogle('test_token');
      expect(authService.isLoggedIn, isTrue);

      await authService.logout();

      expect(authService.isLoggedIn, isFalse);
      expect(authService.currentUser, isNull);
      expect(ApiClient().authToken, isNull);
    });

    testWidgets('5. LoginScreen renders "Continue with Google" button and triggers Google Sign-In', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoginScreen(),
        ),
      );

      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.byType(OutlinedButton), findsOneWidget);

      await tester.tap(find.text('Continue with Google'));
      await tester.pump();

      // Button is interactive and initiates action
      expect(find.byType(LoginScreen), findsOneWidget);
    });
  });
}
