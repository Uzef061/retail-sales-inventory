import '../config/api_config.dart';
import '../../models/reminder.dart';
import 'api_client.dart';

class ReminderService {
  final ApiClient _apiClient = ApiClient();

  Future<List<Reminder>> getReminders({String? status, String? search}) async {
    final queryParams = <String, String>{};
    if (status != null) queryParams['status'] = status;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    String endpoint = ApiConfig.reminders;
    if (queryParams.isNotEmpty) {
      final queryString = Uri(queryParameters: queryParams).query;
      endpoint = '$endpoint?$queryString';
    }

    final response = await _apiClient.get(endpoint);
    if (response is List) {
      return response
          .map((item) => Reminder.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<Reminder> createReminder({
    required String title,
    String? description,
    required DateTime dueDate,
    String priority = 'MEDIUM',
    String? partyName,
  }) async {
    final payload = <String, dynamic>{
      'title': title,
      if (description != null) 'description': description,
      'dueDate': dueDate.toIso8601String(),
      'priority': priority,
      if (partyName != null) 'partyName': partyName,
    };

    final response = await _apiClient.post(ApiConfig.reminders, payload);
    return Reminder.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<Reminder> updateReminder(Reminder reminder) async {
    final response = await _apiClient.put(
      '${ApiConfig.reminders}/${reminder.id}',
      reminder.toJson(),
    );
    return Reminder.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<Reminder> toggleReminder(String id, [bool? isCompleted]) async {
    final response = await _apiClient.put(
      '${ApiConfig.reminders}/$id/toggle',
      isCompleted != null ? {'isCompleted': isCompleted} : {},
    );
    return Reminder.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<void> deleteReminder(String id) async {
    await _apiClient.delete('${ApiConfig.reminders}/$id');
  }
}
