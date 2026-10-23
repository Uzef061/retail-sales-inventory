import 'package:intl/intl.dart';
import '../../models/ledger_entry.dart';
import '../config/api_config.dart';
import 'api_client.dart';

class LedgerDataResult {
  final LedgerSummary summary;
  final List<LedgerEntry> entries;

  LedgerDataResult({required this.summary, required this.entries});
}

class LedgerService {
  final ApiClient _apiClient = ApiClient();

  Future<LedgerDataResult> getLedger({
    String period = 'month',
    DateTime? startDate,
    DateTime? endDate,
    String? search,
    String? type,
  }) async {
    final queryParams = <String, String>{
      'period': period,
    };

    final dateFormat = DateFormat('yyyy-MM-dd');
    if (startDate != null) {
      queryParams['startDate'] = dateFormat.format(startDate);
    }
    if (endDate != null) {
      queryParams['endDate'] = dateFormat.format(endDate);
    }
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }
    if (type != null && type != 'ALL') {
      queryParams['type'] = type;
    }

    final queryString = Uri(queryParameters: queryParams).query;
    final path = '${ApiConfig.ledger}?$queryString';

    final res = await _apiClient.get(path);

    if (res is Map<String, dynamic>) {
      final summaryJson = res['summary'] as Map<String, dynamic>? ?? {};
      final entriesJson = res['entries'] as List<dynamic>? ?? [];

      final summary = LedgerSummary.fromJson(summaryJson);
      final entries = entriesJson
          .map((e) => LedgerEntry.fromJson(e as Map<String, dynamic>))
          .toList();

      return LedgerDataResult(summary: summary, entries: entries);
    }

    return LedgerDataResult(
      summary: const LedgerSummary(),
      entries: [],
    );
  }
}
