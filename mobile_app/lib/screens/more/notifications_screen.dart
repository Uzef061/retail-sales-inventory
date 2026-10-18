import 'package:flutter/material.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/app_notification.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _notificationService = NotificationService();

  List<AppNotification> _notifications = [];
  bool _isLoading = true;
  String? _errorMessage;
  bool _filterOnlyUnread = false;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _notificationService.getNotifications();
      setState(() {
        _notifications = res.notifications;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Could not load notifications: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _markRead(AppNotification notification) async {
    if (notification.isRead) return;

    setState(() {
      final idx = _notifications.indexWhere((n) => n.id == notification.id);
      if (idx != -1) {
        _notifications[idx] = _notifications[idx].copyWith(isRead: true);
      }
    });

    try {
      await _notificationService.markAsRead(notification.id);
    } catch (_) {}
  }

  Future<void> _markAllRead() async {
    setState(() {
      _notifications = _notifications.map((n) => n.copyWith(isRead: true)).toList();
    });

    try {
      await _notificationService.markAllAsRead();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All notifications marked as read'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update notifications: $e'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  Future<void> _delete(AppNotification notification) async {
    setState(() {
      _notifications.removeWhere((n) => n.id == notification.id);
    });

    try {
      await _notificationService.deleteNotification(notification.id);
    } catch (_) {
      _loadNotifications();
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n.isRead).length;
    final displayed = _filterOnlyUnread ? _notifications.where((n) => !n.isRead).toList() : _notifications;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (unreadCount > 0)
            TextButton.icon(
              onPressed: _markAllRead,
              icon: const Icon(Icons.done_all, color: Colors.white, size: 18),
              label: const Text('Mark All Read', style: TextStyle(color: Colors.white, fontSize: 12)),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loadNotifications,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            color: AppTheme.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              children: [
                ChoiceChip(
                  label: Text('All (${_notifications.length})'),
                  selected: !_filterOnlyUnread,
                  onSelected: (val) {
                    if (val) setState(() => _filterOnlyUnread = false);
                  },
                  selectedColor: AppTheme.primary,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: !_filterOnlyUnread ? FontWeight.bold : FontWeight.normal,
                    color: !_filterOnlyUnread ? Colors.white : AppTheme.textPrimary,
                  ),
                  showCheckmark: false,
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text('Unread ($unreadCount)'),
                  selected: _filterOnlyUnread,
                  onSelected: (val) {
                    if (val) setState(() => _filterOnlyUnread = true);
                  },
                  selectedColor: AppTheme.primary,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: _filterOnlyUnread ? FontWeight.bold : FontWeight.normal,
                    color: _filterOnlyUnread ? Colors.white : AppTheme.textPrimary,
                  ),
                  showCheckmark: false,
                ),
                const Spacer(),
                const Text(
                  'In-App Store Alerts',
                  style: TextStyle(fontSize: 11, color: AppTheme.textMuted, fontStyle: FontStyle.italic),
                ),
              ],
            ),
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppTheme.error),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadNotifications, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : displayed.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.notifications_none, size: 48, color: AppTheme.primary),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _filterOnlyUnread ? 'No unread notifications' : 'No notifications yet',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Low stock alerts, task reminders, and cash transactions will notify you here automatically.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadNotifications,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: displayed.length,
                        itemBuilder: (ctx, i) {
                          final item = displayed[i];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            elevation: item.isRead ? 0 : 2,
                            color: item.isRead ? Colors.white : const Color(0xFFF0FDF4),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                color: item.isRead ? Colors.black12 : AppTheme.primary.withValues(alpha: 0.3),
                                width: item.isRead ? 1 : 1.5,
                              ),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              leading: _buildIcon(item.type),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.title,
                                      style: TextStyle(
                                        fontWeight: item.isRead ? FontWeight.w600 : FontWeight.bold,
                                        fontSize: 14,
                                        color: AppTheme.textPrimary,
                                      ),
                                    ),
                                  ),
                                  if (!item.isRead)
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: AppTheme.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                ],
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text(
                                    item.message,
                                    style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${item.timestamp.year}-${item.timestamp.month.toString().padLeft(2, '0')}-${item.timestamp.day.toString().padLeft(2, '0')} ${item.timestamp.hour.toString().padLeft(2, '0')}:${item.timestamp.minute.toString().padLeft(2, '0')}',
                                    style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                                  ),
                                ],
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.close, size: 16, color: AppTheme.textMuted),
                                onPressed: () => _delete(item),
                              ),
                              onTap: () => _markRead(item),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  Widget _buildIcon(String type) {
    IconData icon;
    Color bg;
    Color fg;

    switch (type.toUpperCase()) {
      case 'STOCK_LOW':
        icon = Icons.warning_amber_rounded;
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFB45309);
        break;
      case 'PAYMENT_RECEIVED':
        icon = Icons.arrow_downward;
        bg = const Color(0xFFDCFCE7);
        fg = AppTheme.success;
        break;
      case 'PAYMENT_GIVEN':
        icon = Icons.arrow_upward;
        bg = const Color(0xFFFEE2E2);
        fg = AppTheme.error;
        break;
      case 'REMINDER_DUE':
        icon = Icons.alarm;
        bg = const Color(0xFFEDE9FE);
        fg = const Color(0xFF7C3AED);
        break;
      default:
        icon = Icons.notifications_outlined;
        bg = AppTheme.primaryLight;
        fg = AppTheme.primary;
    }

    return CircleAvatar(
      backgroundColor: bg,
      child: Icon(icon, color: fg, size: 20),
    );
  }
}
