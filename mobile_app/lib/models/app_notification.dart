class AppNotification {
  final String id;
  final String userId;
  final String title;
  final String message;
  final String type; // 'LOW_STOCK', 'REMINDER', 'PAYMENT', 'SALE', 'SYSTEM'
  final bool isRead;
  final String relatedId;
  final DateTime timestamp;

  AppNotification({
    required this.id,
    required this.userId,
    required this.title,
    required this.message,
    this.type = 'SYSTEM',
    this.isRead = false,
    this.relatedId = '',
    required this.timestamp,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notification',
      message: json['message']?.toString() ?? '',
      type: json['type']?.toString().toUpperCase() ?? 'SYSTEM',
      isRead: json['isRead'] == true,
      relatedId: json['relatedId']?.toString() ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'message': message,
      'type': type,
      'isRead': isRead,
      'relatedId': relatedId,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  AppNotification copyWith({
    bool? isRead,
  }) {
    return AppNotification(
      id: id,
      userId: userId,
      title: title,
      message: message,
      type: type,
      isRead: isRead ?? this.isRead,
      relatedId: relatedId,
      timestamp: timestamp,
    );
  }
}
