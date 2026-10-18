import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_app/core/config/api_config.dart';
import 'package:mobile_app/core/services/api_client.dart';
import 'package:mobile_app/core/services/auth_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Session Storage Independent Verification', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('1. Initializes the shared preferences plugin', () async {
      final prefs = await SharedPreferences.getInstance();
      expect(prefs, isNotNull);
    });

    test('2, 3, 4. Writes, reads, and removes a harmless test value', () async {
      final prefs = await SharedPreferences.getInstance();

      // 2. Write harmless test value
      const testKey = 'diagnostic_storage_test_key';
      const testVal = 'harmless_test_payload_12345';
      final writeSuccess = await prefs.setString(testKey, testVal);
      expect(writeSuccess, isTrue);

      // 3. Read it back successfully
      final readVal = prefs.getString(testKey);
      expect(readVal, equals(testVal));

      // 4. Remove the test value
      final removeSuccess = await prefs.remove(testKey);
      expect(removeSuccess, isTrue);
      expect(prefs.getString(testKey), isNull);
    });

    test('5. Persists and retrieves authentication session using existing storage mechanism', () async {
      final authService = AuthService();
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'message': 'Login successful',
            'token': 'mock_jwt_session_token_xyz',
            'user': {
              'id': 'user_001',
              'username': 'admin',
              'name': 'Store Admin',
              'role': 'ADMIN',
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      ApiClient().setMockClient(mockClient);

      // Execute login which invokes session persistence
      final loggedInUser = await authService.login('admin', 'password123');
      expect(loggedInUser.username, equals('admin'));
      expect(authService.isLoggedIn, isTrue);

      // Verify token persisted in ApiClient
      expect(ApiClient().authToken, equals('mock_jwt_session_token_xyz'));

      // Verify raw session persisted in SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      final savedUserJson = prefs.getString(ApiConfig.prefsUserKey);
      expect(savedUserJson, isNotNull);
      final decoded = jsonDecode(savedUserJson!) as Map<String, dynamic>;
      expect(decoded['username'], equals('admin'));
      expect(decoded['role'], equals('ADMIN'));

      // Simulate app restart / cold start with fresh AuthService.init()
      final freshAuthService = AuthService();
      await freshAuthService.init();
      expect(freshAuthService.isLoggedIn, isTrue);
      expect(freshAuthService.currentUser?.username, equals('admin'));
      expect(freshAuthService.currentUser?.role, equals('ADMIN'));

      // Verify clean logout removes session data
      await freshAuthService.logout();
      expect(freshAuthService.isLoggedIn, isFalse);
      expect(prefs.getString(ApiConfig.prefsUserKey), isNull);
      expect(ApiClient().authToken, isNull);
    });
  });
}
