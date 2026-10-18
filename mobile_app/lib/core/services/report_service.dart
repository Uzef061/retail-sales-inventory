import '../config/api_config.dart';
import '../../models/report_data.dart';
import 'api_client.dart';

class ReportService {
  final ApiClient _apiClient = ApiClient();

  Future<ReportData> getReports({
    String mode = 'week',
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final queryParams = <String, String>{'mode': mode};
    if (startDate != null) {
      queryParams['startDate'] = startDate.toIso8601String().split('T')[0];
    }
    if (endDate != null) {
      queryParams['endDate'] = endDate.toIso8601String().split('T')[0];
    }

    final queryString = Uri(queryParameters: queryParams).query;
    final endpoint = '${ApiConfig.reports}?$queryString';

    final response = await _apiClient.get(endpoint);
    if (response is Map) {
      return ReportData.fromJson(Map<String, dynamic>.from(response));
    }
    throw ApiException(
      statusCode: 200,
      category: AuthErrorCategory.responseShape,
      correlationId: 'report_fetch',
      message: 'Failed to parse report data from server.',
    );
  }

  Future<ReportData> getComprehensiveReport({String timeRange = 'month'}) async {
    return getReports(mode: timeRange);
  }
}
