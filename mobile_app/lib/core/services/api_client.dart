import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

enum AuthErrorCategory {
  network,
  timeout,
  http,
  parse,
  responseShape,
  storage,
  navigation,
  unknown,
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic details;
  final AuthErrorCategory category;
  final String? correlationId;

  ApiException({
    required this.statusCode,
    required this.message,
    this.details,
    this.category = AuthErrorCategory.http,
    this.correlationId,
  });

  bool get isNotFound => statusCode == 404;
  bool get isUnauthorized => statusCode == 401 || statusCode == 403;
  bool get isConnectionError => category == AuthErrorCategory.network || statusCode == 0;
  bool get isTimeout => category == AuthErrorCategory.timeout || statusCode == 408;

  @override
  String toString() {
    final cat = category.name.toUpperCase();
    final req = correlationId != null ? ' [$correlationId]' : '';
    return 'ApiException ($cat$req, status: $statusCode): $message';
  }
}

class AuthLogger {
  static bool enableDetailedLogs = true;

  static void logStage({
    required String correlationId,
    required String stage,
    String? method,
    String? endpoint,
    int? statusCode,
    int? elapsedMs,
    String? contentType,
    String? redactedBody,
    bool? tokenPersisted,
    String? errorCategory,
    String? exceptionClass,
    String? exceptionMessage,
    StackTrace? stackTrace,
  }) {
    if (!enableDetailedLogs) return;

    final buffer = StringBuffer();
    buffer.write('[AUTH_DIAGNOSTIC] id=$correlationId stage=$stage');
    if (method != null && endpoint != null) {
      buffer.write(' req="$method $endpoint"');
    }
    if (statusCode != null) {
      buffer.write(' status=$statusCode');
    }
    if (elapsedMs != null) {
      buffer.write(' elapsed=${elapsedMs}ms');
    }
    if (contentType != null && contentType.isNotEmpty) {
      buffer.write(' type="$contentType"');
    }
    if (tokenPersisted != null) {
      buffer.write(' tokenPersisted=$tokenPersisted');
    }
    if (errorCategory != null) {
      buffer.write(' category=$errorCategory');
    }
    if (exceptionClass != null) {
      buffer.write(' errClass=$exceptionClass');
    }
    if (exceptionMessage != null) {
      buffer.write(' err="$exceptionMessage"');
    }
    if (redactedBody != null && redactedBody.isNotEmpty) {
      buffer.write(' body="$redactedBody"');
    }

    debugPrint(buffer.toString());
    if (stackTrace != null && kDebugMode) {
      debugPrint('[AUTH_DIAGNOSTIC] stack: $stackTrace');
    }
  }

  static String redactResponseBody(String rawBody, {int maxLength = 220}) {
    if (rawBody.isEmpty) return '';
    try {
      final dynamic decoded = jsonDecode(rawBody);
      if (decoded is Map) {
        final Map<String, dynamic> copy = Map<String, dynamic>.from(decoded);
        if (copy.containsKey('token')) {
          copy['token'] = '<REDACTED_JWT>';
        }
        if (copy.containsKey('password')) {
          copy['password'] = '<REDACTED_SECRET>';
        }
        final sanitized = jsonEncode(copy);
        return sanitized.length > maxLength
            ? '${sanitized.substring(0, maxLength)}...'
            : sanitized;
      }
    } catch (_) {
      // Non-JSON response (e.g. HTML error page)
    }
    final singleLine = rawBody.replaceAll(RegExp(r'\s+'), ' ').trim();
    return singleLine.length > maxLength
        ? '${singleLine.substring(0, maxLength)}...'
        : singleLine;
  }
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  String _baseUrl = ApiConfig.defaultLiveUrl;
  String? _authToken;
  http.Client? _mockClient;

  String get baseUrl => _baseUrl;
  String? get authToken => _authToken;

  @visibleForTesting
  void setMockClient(http.Client? client) {
    _mockClient = client;
  }

  http.Client get _client => _mockClient ?? http.Client();

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUrl = prefs.getString(ApiConfig.prefsBaseUrlKey);
    if (savedUrl != null && savedUrl.trim().isNotEmpty) {
      String clean = savedUrl.trim();
      while (clean.endsWith('/')) {
        clean = clean.substring(0, clean.length - 1);
      }
      _baseUrl = clean;
    }
    _authToken = prefs.getString(ApiConfig.prefsTokenKey);
  }

  Future<void> setBaseUrl(String newUrl) async {
    String formatted = newUrl.trim();
    while (formatted.endsWith('/')) {
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
    String base = _baseUrl.trim();
    while (base.endsWith('/')) {
      base = base.substring(0, base.length - 1);
    }
    String path = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    if (base.endsWith('/api') && path.startsWith('/api/')) {
      base = base.substring(0, base.length - 4);
    }
    String fullUrl = '$base$path';

    if (queryParams != null && queryParams.isNotEmpty) {
      final query = queryParams.map((k, v) => MapEntry(k, v.toString()));
      return Uri.parse(fullUrl).replace(queryParameters: query);
    }
    return Uri.parse(fullUrl);
  }

  dynamic _processResponse(http.Response response, {String? correlationId}) {
    dynamic decoded;
    final contentType = response.headers['content-type'] ?? '';

    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } catch (e, stack) {
        AuthLogger.logStage(
          correlationId: correlationId ?? 'req',
          stage: 'response_json_decode_failed',
          statusCode: response.statusCode,
          contentType: contentType,
          errorCategory: AuthErrorCategory.parse.name,
          exceptionClass: 'FormatException',
          exceptionMessage: e.toString(),
          stackTrace: stack,
        );

        // If HTTP 2xx but body is not valid JSON, reject it
        if (response.statusCode >= 200 && response.statusCode < 300) {
          throw ApiException(
            statusCode: response.statusCode,
            category: AuthErrorCategory.parse,
            correlationId: correlationId,
            message: 'Server returned an invalid response format (not valid JSON).',
            details: AuthLogger.redactResponseBody(response.body),
          );
        }
        decoded = response.body;
      }
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }

    String message = 'Request failed with status ${response.statusCode}';
    if (decoded is Map && decoded['message'] != null) {
      message = decoded['message'].toString();
    } else if (response.statusCode == 400) {
      message = 'Bad request (400). Please check your inputs.';
    } else if (response.statusCode == 401) {
      message = 'Invalid username or password (401).';
    } else if (response.statusCode == 403) {
      message = 'Access forbidden (403).';
    } else if (response.statusCode == 404) {
      message = 'Requested resource not found (404).';
    } else if (response.statusCode == 422) {
      message = 'Validation error (422).';
    } else if (response.statusCode == 429) {
      message = 'Too many requests (429). Please wait a moment and try again.';
    } else if (response.statusCode == 500) {
      message = 'Server encountered an internal error (500). Please try again later.';
    } else if (response.statusCode == 502 || response.statusCode == 503) {
      message = 'Server is currently unavailable (${response.statusCode}). The backend service may be restarting.';
    }

    throw ApiException(
      statusCode: response.statusCode,
      category: AuthErrorCategory.http,
      correlationId: correlationId,
      message: message,
      details: decoded,
    );
  }

  Future<dynamic> get(String endpoint, {Map<String, dynamic>? queryParams, String? correlationId}) async {
    final reqId = correlationId ?? 'get_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
    final stopwatch = Stopwatch()..start();
    try {
      final uri = _buildUri(endpoint, queryParams);
      final response = await _client
          .get(uri, headers: _buildHeaders())
          .timeout(ApiConfig.timeoutDuration);
      stopwatch.stop();
      return _processResponse(response, correlationId: reqId);
    } on SocketException catch (e, stack) {
      stopwatch.stop();
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'failed',
        endpoint: endpoint,
        errorCategory: AuthErrorCategory.network.name,
        exceptionClass: 'SocketException',
        exceptionMessage: e.message,
        stackTrace: stack,
      );
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.network,
        correlationId: reqId,
        message: 'Cannot connect to server. Please check internet connection or server URL in Settings.',
      );
    } on TimeoutException catch (e, stack) {
      stopwatch.stop();
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'failed',
        endpoint: endpoint,
        errorCategory: AuthErrorCategory.timeout.name,
        exceptionClass: 'TimeoutException',
        exceptionMessage: e.message ?? 'Timeout',
        stackTrace: stack,
      );
      throw ApiException(
        statusCode: 408,
        category: AuthErrorCategory.timeout,
        correlationId: reqId,
        message: 'Server took too long to respond. The free Render instance might be waking up.',
      );
    } catch (e, stack) {
      stopwatch.stop();
      if (e is ApiException) rethrow;

      final isNetwork = e is http.ClientException ||
          e is HttpException ||
          e.runtimeType.toString().contains('Socket') ||
          e.runtimeType.toString().contains('Handshake') ||
          e.runtimeType.toString().contains('Tls') ||
          e.runtimeType.toString().contains('Certificate');

      final category = isNetwork ? AuthErrorCategory.network : AuthErrorCategory.unknown;
      final msg = isNetwork
          ? 'Network error: Cannot reach server. Please check internet access or server settings.'
          : 'Request failed: $e';

      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'failed',
        endpoint: endpoint,
        errorCategory: category.name,
        exceptionClass: e.runtimeType.toString(),
        exceptionMessage: e.toString(),
        stackTrace: stack,
      );

      throw ApiException(
        statusCode: 0,
        category: category,
        correlationId: reqId,
        message: msg,
        details: e.toString(),
      );
    }
  }

  Future<dynamic> post(String endpoint, [Map<String, dynamic>? body, String? correlationId]) async {
    final reqId = correlationId ?? 'post_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
    final stopwatch = Stopwatch()..start();
    final uri = _buildUri(endpoint);

    AuthLogger.logStage(
      correlationId: reqId,
      stage: 'request_started',
      method: 'POST',
      endpoint: endpoint,
    );

    try {
      final response = await _client
          .post(
            uri,
            headers: _buildHeaders(),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(ApiConfig.timeoutDuration);

      stopwatch.stop();

      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'response_received',
        method: 'POST',
        endpoint: endpoint,
        statusCode: response.statusCode,
        elapsedMs: stopwatch.elapsedMilliseconds,
        contentType: response.headers['content-type'],
        redactedBody: AuthLogger.redactResponseBody(response.body),
      );

      return _processResponse(response, correlationId: reqId);
    } on SocketException catch (e, stack) {
      stopwatch.stop();
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'failed',
        method: 'POST',
        endpoint: endpoint,
        elapsedMs: stopwatch.elapsedMilliseconds,
        errorCategory: AuthErrorCategory.network.name,
        exceptionClass: 'SocketException',
        exceptionMessage: e.message,
        stackTrace: stack,
      );
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.network,
        correlationId: reqId,
        message: 'Cannot connect to server. Please check internet connection or server URL in Settings.',
      );
    } on TimeoutException catch (e, stack) {
      stopwatch.stop();
      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'failed',
        method: 'POST',
        endpoint: endpoint,
        elapsedMs: stopwatch.elapsedMilliseconds,
        errorCategory: AuthErrorCategory.timeout.name,
        exceptionClass: 'TimeoutException',
        exceptionMessage: e.message ?? 'Timeout',
        stackTrace: stack,
      );
      throw ApiException(
        statusCode: 408,
        category: AuthErrorCategory.timeout,
        correlationId: reqId,
        message: 'Server took too long to respond. The free Render instance might be waking up.',
      );
    } catch (e, stack) {
      stopwatch.stop();
      if (e is ApiException) rethrow;

      final isNetwork = e is http.ClientException ||
          e is HttpException ||
          e.runtimeType.toString().contains('Socket') ||
          e.runtimeType.toString().contains('Handshake') ||
          e.runtimeType.toString().contains('Tls') ||
          e.runtimeType.toString().contains('Certificate');

      final category = isNetwork ? AuthErrorCategory.network : AuthErrorCategory.unknown;
      final msg = isNetwork
          ? 'Network error: Cannot reach server. Please check internet access or server settings.'
          : 'Request failed: $e';

      AuthLogger.logStage(
        correlationId: reqId,
        stage: 'failed',
        method: 'POST',
        endpoint: endpoint,
        elapsedMs: stopwatch.elapsedMilliseconds,
        errorCategory: category.name,
        exceptionClass: e.runtimeType.toString(),
        exceptionMessage: e.toString(),
        stackTrace: stack,
      );

      throw ApiException(
        statusCode: 0,
        category: category,
        correlationId: reqId,
        message: msg,
        details: e.toString(),
      );
    }
  }

  Future<dynamic> put(String endpoint, [Map<String, dynamic>? body, String? correlationId]) async {
    final reqId = correlationId ?? 'put_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
    try {
      final uri = _buildUri(endpoint);
      final response = await _client
          .put(
            uri,
            headers: _buildHeaders(),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(ApiConfig.timeoutDuration);
      return _processResponse(response, correlationId: reqId);
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.network,
        correlationId: reqId,
        message: 'Cannot connect to server.',
      );
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        category: AuthErrorCategory.timeout,
        correlationId: reqId,
        message: 'Server took too long to respond.',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.unknown,
        correlationId: reqId,
        message: e.toString(),
      );
    }
  }

  Future<dynamic> delete(String endpoint, {String? correlationId}) async {
    final reqId = correlationId ?? 'del_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
    try {
      final uri = _buildUri(endpoint);
      final response = await _client
          .delete(uri, headers: _buildHeaders())
          .timeout(ApiConfig.timeoutDuration);
      return _processResponse(response, correlationId: reqId);
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.network,
        correlationId: reqId,
        message: 'Cannot connect to server.',
      );
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        category: AuthErrorCategory.timeout,
        correlationId: reqId,
        message: 'Server took too long to respond.',
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        statusCode: 0,
        category: AuthErrorCategory.unknown,
        correlationId: reqId,
        message: e.toString(),
      );
    }
  }

  Future<bool> testConnection() async {
    try {
      final uri = _buildUri(ApiConfig.dashboard);
      final response = await _client.get(uri).timeout(const Duration(seconds: 8));
      return response.statusCode >= 200 && response.statusCode < 500;
    } catch (_) {
      return false;
    }
  }
}
