import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../../models/user.dart';
import 'api_client.dart';

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final ApiClient _apiClient = ApiClient();
  User? _currentUser;
  bool _initialized = false;

  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;
  bool get isInitialized => _initialized;

  Future<void> init() async {
    await _apiClient.init();
    final prefs = await SharedPreferences.getInstance();
    final userJsonStr = prefs.getString(ApiConfig.prefsUserKey);
    if (userJsonStr != null) {
      try {
        final Map<String, dynamic> userMap = jsonDecode(userJsonStr);
        _currentUser = User.fromJson(userMap);
      } catch (_) {
        _currentUser = null;
      }
    }
    _initialized = true;
    notifyListeners();
  }

  Future<User> login(String username, String password) async {
    final response = await _apiClient.post(ApiConfig.authLogin, {
      'username': username.trim(),
      'password': password,
    });

    String? token;
    User user;

    if (response is Map<String, dynamic>) {
      token = response['token']?.toString();

      if (response['user'] is Map<String, dynamic>) {
        user = User.fromJson(response['user'] as Map<String, dynamic>);
      } else {
        // Handle deployed Render backend where response contains { message: '...', username: 'admin' }
        final uName = response['username']?.toString() ?? username.trim();
        user = User(
          id: 'user_${DateTime.now().millisecondsSinceEpoch}',
          username: uName,
          name: uName.toUpperCase(),
          role: uName.toLowerCase().contains('cashier') ? 'CASHIER' : 'ADMIN',
        );
      }
    } else {
      user = User(
        id: 'user_fallback',
        username: username.trim(),
        name: username.trim(),
        role: 'ADMIN',
      );
    }

    if (token != null && token.isNotEmpty) {
      await _apiClient.setToken(token);
    }

    _currentUser = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConfig.prefsUserKey, jsonEncode(user.toJson()));

    notifyListeners();
    return user;
  }

  Future<void> logout() async {
    _currentUser = null;
    await _apiClient.setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(ApiConfig.prefsUserKey);
    notifyListeners();
  }
}
