import '../config/api_config.dart';
import '../../models/app_notification.dart';
import 'api_client.dart';

class NotificationService {
  final ApiClient _apiClient = ApiClient();

  Future<({List<AppNotification> notifications, int unreadCount})> getNotifications() async {
    final response = await _apiClient.get(ApiConfig.notifications);
    if (response is Map) {
      final notifRaw = response['notifications'] as List<dynamic>? ?? [];
      final list = notifRaw
          .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
          .toList();
      final unread = (response['unreadCount'] as num?)?.toInt() ?? 0;
      return (notifications: list, unreadCount: unread);
    }
    return (notifications: <AppNotification>[], unreadCount: 0);
  }

  Future<void> markAsRead(String id) async {
    await _apiClient.put('${ApiConfig.notifications}/$id/read', {});
  }

  Future<void> markAllAsRead() async {
    await _apiClient.put('${ApiConfig.notifications}/read-all', {});
  }

  Future<void> deleteNotification(String id) async {
    await _apiClient.delete('${ApiConfig.notifications}/$id');
  }
}
