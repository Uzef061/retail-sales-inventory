import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
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
  bool get hasCompletedOnboarding => _currentUser?.hasCompletedOnboarding ?? false;

  Future<void> init() async {
    await _apiClient.init();
    try {
      final prefs = await SharedPreferences.getInstance();
      final userJsonStr = prefs.getString(ApiConfig.prefsUserKey);
      if (userJsonStr != null) {
        final Map<String, dynamic> userMap = jsonDecode(userJsonStr);
        _currentUser = User.fromJson(userMap);
      }
    } catch (e, stack) {
      AuthLogger.logStage(
        correlationId: 'init',
        stage: 'init_user_load_failed',
        errorCategory: AuthErrorCategory.storage.name,
        exceptionClass: e.runtimeType.toString(),
        exceptionMessage: e.toString(),
        stackTrace: stack,
      );
      _currentUser = null;
    }
    _initialized = true;
    notifyListeners();
  }

  Future<User> login(String username, String password) async {
    final reqId = 'login_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';

    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'validation',
    );

    final cleanUsername = username.trim();
    if (cleanUsername.isEmpty || password.isEmpty) {
      throw ApiException(
        statusCode: 400,
        category: AuthErrorCategory.http,
        correlationId: reqId,
        message: 'Username and password are required.',
      );
    }

    final response = await _apiClient.post(
      ApiConfig.authLogin,
      {
        'username': cleanUsername,
        'password': password,
      },
      reqId,
    );

    return _processAuthResponse(response, reqId, fallbackUsername: cleanUsername);
  }

  Future<User?> signInWithGoogle({GoogleSignIn? googleSignInClient}) async {
    final reqId = 'google_signin_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';

    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'google_sdk_init',
    );

    final GoogleSignIn googleSignIn = googleSignInClient ??
        GoogleSignIn(
          scopes: const ['email', 'profile'],
          serverClientId: ApiConfig.googleServerClientId.isNotEmpty
              ? ApiConfig.googleServerClientId
              : null,
        );

    GoogleSignInAccount? account;
    try {
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'google_prompt_started',
      );
      account = await googleSignIn.signIn();
    } catch (e) {
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'google_prompt_failed',
      );
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.network,
        correlationId: reqId,
        message: 'Google Sign-In prompt failed: $e',
      );
    }

    if (account == null) {
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'google_prompt_cancelled',
      );
      return null;
    }

    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'google_account_selected',
    );

    final GoogleSignInAuthentication auth = await account.authentication;
    final String? idToken = auth.idToken;

    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'google_token_retrieved',
    );

    if (idToken == null || idToken.isEmpty) {
      if (ApiConfig.googleServerClientId.isEmpty) {
        throw ApiException(
          statusCode: 400,
          category: AuthErrorCategory.http,
          correlationId: reqId,
          message: 'Google Sign-In configuration error: Missing Google Web Client ID (GOOGLE_SERVER_CLIENT_ID). On Android, retrieving an ID token requires setting serverClientId.',
        );
      } else {
        throw ApiException(
          statusCode: 400,
          category: AuthErrorCategory.http,
          correlationId: reqId,
          message: 'Google did not return an ID token for this account. Ensure the Google Cloud OAuth client ID and Android SHA-1 fingerprint are properly registered.',
        );
      }
    }

    return loginWithGoogle(idToken);
  }

  Future<User> loginWithGoogle(String idToken) async {
    final reqId = 'google_login_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';

    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'google_token_validation',
    );

    if (idToken.trim().isEmpty) {
      throw ApiException(
        statusCode: 400,
        category: AuthErrorCategory.http,
        correlationId: reqId,
        message: 'Google identification token is empty.',
      );
    }

    final response = await _apiClient.post(
      ApiConfig.authGoogle,
      {
        'idToken': idToken.trim(),
      },
      reqId,
    );

    return _processAuthResponse(response, reqId, fallbackUsername: 'google_user');
  }

  Future<User> _processAuthResponse(dynamic response, String reqId, {required String fallbackUsername}) async {
    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'parsing',
    );

    if (response is! Map) {
      throw ApiException(
        statusCode: 200,
        category: AuthErrorCategory.responseShape,
        correlationId: reqId,
        message: 'Unexpected response from server: expected JSON object.',
        details: response,
      );
    }

    final respMap = Map<String, dynamic>.from(response);

    if (respMap.containsKey('success') && respMap['success'] == false) {
      final msg = respMap['message']?.toString() ?? 'Login was rejected by the server.';
      throw ApiException(
        statusCode: 401,
        category: AuthErrorCategory.http,
        correlationId: reqId,
        message: msg,
        details: respMap,
      );
    }

    final token = respMap['token']?.toString();
    if (token == null || token.trim().isEmpty) {
      throw ApiException(
        statusCode: 200,
        category: AuthErrorCategory.responseShape,
        correlationId: reqId,
        message: 'Authentication token missing from server response.',
        details: respMap,
      );
    }

    User user;
    if (respMap['user'] is Map) {
      user = User.fromJson(Map<String, dynamic>.from(respMap['user'] as Map));
    } else {
      final uName = respMap['username']?.toString() ?? fallbackUsername;
      user = User(
        id: 'user_${DateTime.now().millisecondsSinceEpoch}',
        username: uName,
        name: uName.toUpperCase(),
        role: uName.toLowerCase().contains('cashier') ? 'CASHIER' : 'ADMIN',
      );
    }

    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'token_persistence',
    );

    try {
      await _apiClient.setToken(token);
      _currentUser = user;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(ApiConfig.prefsUserKey, jsonEncode(user.toJson()));

      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'token_persistence_completed',
        tokenPersisted: true,
      );
    } catch (e, stack) {
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'token_persistence_failed',
        tokenPersisted: false,
        errorCategory: AuthErrorCategory.storage.name,
        exceptionClass: e.runtimeType.toString(),
        exceptionMessage: e.toString(),
        stackTrace: stack,
      );
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.storage,
        correlationId: reqId,
        message: 'Failed to securely store authentication session on device storage: $e',
        details: e.toString(),
      );
    }

    notifyListeners();
    return user;
  }

  Future<void> completeOnboarding({
    String? businessName,
    String? category,
    String? phone,
    String? currency,
    String? ownerName,
  }) async {
    final reqId = 'onboarding_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
    try {
      await _apiClient.put(
        ApiConfig.authOnboarding,
        {
          'hasCompletedOnboarding': true,
          if (businessName != null) 'businessName': businessName,
          if (category != null) 'category': category,
          if (phone != null) 'phone': phone,
          if (currency != null) 'currency': currency,
          if (ownerName != null) 'ownerName': ownerName,
        },
        reqId,
      );
    } catch (e) {
      debugPrint('[AUTH] Server onboarding update failed: $e. Proceeding locally.');
    }

    if (_currentUser != null) {
      _currentUser = User(
        id: _currentUser!.id,
        username: _currentUser!.username,
        name: ownerName?.isNotEmpty == true ? ownerName! : _currentUser!.name,
        role: _currentUser!.role,
        email: _currentUser!.email,
        avatar: _currentUser!.avatar,
        hasCompletedOnboarding: true,
        businessId: _currentUser!.businessId,
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(ApiConfig.prefsUserKey, jsonEncode(_currentUser!.toJson()));
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _currentUser = null;
    try {
      await _apiClient.setToken(null);
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(ApiConfig.prefsUserKey);
    } catch (_) {}
    notifyListeners();
  }
}
