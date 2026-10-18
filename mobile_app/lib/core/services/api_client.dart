import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic details;

  ApiException({
    required this.statusCode,
    required this.message,
    this.details,
  });

  bool get isNotFound => statusCode == 404;
  bool get isUnauthorized => statusCode == 401 || statusCode == 403;
  bool get isConnectionError => statusCode == 0;

  @override
  String toString() => 'ApiException [$statusCode]: $message';
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  String _baseUrl = ApiConfig.defaultLiveUrl;
  String? _authToken;

  String get baseUrl => _baseUrl;
  String? get authToken => _authToken;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUrl = prefs.getString(ApiConfig.prefsBaseUrlKey);
    if (savedUrl != null && savedUrl.trim().isNotEmpty) {
      _baseUrl = savedUrl.trim();
    }
    _authToken = prefs.getString(ApiConfig.prefsTokenKey);
  }

  Future<void> setBaseUrl(String newUrl) async {
    String formatted = newUrl.trim();
    if (formatted.endsWith('/')) {
      formatted = formatted.substring(0, formatted.length - 1);
    }
    _baseUrl = formatted;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConfig.prefsBaseUrlKey, _baseUrl);
  }

  Future<void> setToken(String? token) async {
    _authToken = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null && token.isNotEmpty) {
      await prefs.setString(ApiConfig.prefsTokenKey, token);
    } else {
      await prefs.remove(ApiConfig.prefsTokenKey);
    }
  }

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_authToken != null && _authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  Uri _buildUri(String endpoint, [Map<String, dynamic>? queryParams]) {
    String path = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    String fullUrl = '$_baseUrl$path';

    if (queryParams != null && queryParams.isNotEmpty) {
      final query = queryParams.map((k, v) => MapEntry(k, v.toString()));
      return Uri.parse(fullUrl).replace(queryParameters: query);
    }
    return Uri.parse(fullUrl);
  }

  dynamic _processResponse(http.Response response) {
    dynamic decoded;
    try {
      if (response.body.isNotEmpty) {
        decoded = jsonDecode(response.body);
      }
    } catch (_) {
      decoded = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }

    String message = 'Request failed with status ${response.statusCode}';
    if (decoded is Map && decoded['message'] != null) {
      message = decoded['message'].toString();
    } else if (response.statusCode == 404) {
      message = 'Requested resource not found (404)';
    } else if (response.statusCode == 401) {
      message = 'Authentication required or session expired (401)';
    }

    throw ApiException(
      statusCode: response.statusCode,
      message: message,
      details: decoded,
    );
  }

  Future<dynamic> get(String endpoint, {Map<String, dynamic>? queryParams}) async {
    try {
      final uri = _buildUri(endpoint, queryParams);
      final response = await http
          .get(uri, headers: _buildHeaders())
          .timeout(ApiConfig.timeoutDuration);
      return _processResponse(response);
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        message: 'Cannot connect to server. Please check internet connection or server URL in Settings.',
      );
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        message: 'Server took too long to respond. The free Render instance might be waking up.',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: e.toString());
    }
  }

  Future<dynamic> post(String endpoint, [Map<String, dynamic>? body]) async {
    try {
      final uri = _buildUri(endpoint);
      final response = await http
          .post(
            uri,
            headers: _buildHeaders(),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(ApiConfig.timeoutDuration);
      return _processResponse(response);
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        message: 'Cannot connect to server. Please check internet connection or server URL in Settings.',
      );
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        message: 'Server took too long to respond.',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: e.toString());
    }
  }

  Future<dynamic> put(String endpoint, [Map<String, dynamic>? body]) async {
    try {
      final uri = _buildUri(endpoint);
      final response = await http
          .put(
            uri,
            headers: _buildHeaders(),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(ApiConfig.timeoutDuration);
      return _processResponse(response);
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        message: 'Cannot connect to server.',
      );
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        message: 'Server took too long to respond.',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: e.toString());
    }
  }

  Future<dynamic> delete(String endpoint) async {
    try {
      final uri = _buildUri(endpoint);
      final response = await http
          .delete(uri, headers: _buildHeaders())
          .timeout(ApiConfig.timeoutDuration);
      return _processResponse(response);
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        message: 'Cannot connect to server.',
      );
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        message: 'Server took too long to respond.',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(statusCode: 0, message: e.toString());
    }
  }

  Future<bool> testConnection() async {
    try {
      final uri = _buildUri(ApiConfig.dashboard);
      final response = await http.get(uri).timeout(const Duration(seconds: 8));
      return response.statusCode >= 200 && response.statusCode < 500;
    } catch (_) {
      return false;
    }
  }
}
