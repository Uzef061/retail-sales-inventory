class Reminder {
  final String id;
  final String userId;
  final String title;
  final String description;
  final DateTime dueDate;
  final String priority; // 'LOW', 'MEDIUM', 'HIGH'
  final bool isCompleted;
  final DateTime? completedAt;
  final String partyName;

  Reminder({
    required this.id,
    required this.userId,
    required this.title,
    this.description = '',
    required this.dueDate,
    this.priority = 'MEDIUM',
    this.isCompleted = false,
    this.completedAt,
    this.partyName = '',
  });

  bool get isOverdue => !isCompleted && dueDate.isBefore(DateTime.now());

  factory Reminder.fromJson(Map<String, dynamic> json) {
    return Reminder(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      dueDate: json['dueDate'] != null
          ? DateTime.tryParse(json['dueDate'].toString()) ?? DateTime.now()
          : DateTime.now(),
      priority: json['priority']?.toString().toUpperCase() ?? 'MEDIUM',
      isCompleted: json['isCompleted'] == true,
      completedAt: json['completedAt'] != null
          ? DateTime.tryParse(json['completedAt'].toString())
          : null,
      partyName: json['partyName']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'description': description,
      'dueDate': dueDate.toIso8601String(),
      'priority': priority,
      'partyName': partyName,
      'isCompleted': isCompleted,
    };
  }

  Reminder copyWith({
    String? title,
    String? description,
    DateTime? dueDate,
    String? priority,
    bool? isCompleted,
    DateTime? completedAt,
    String? partyName,
  }) {
    return Reminder(
      id: id,
      userId: userId,
      title: title ?? this.title,
      description: description ?? this.description,
      dueDate: dueDate ?? this.dueDate,
      priority: priority ?? this.priority,
      isCompleted: isCompleted ?? this.isCompleted,
      completedAt: completedAt ?? this.completedAt,
      partyName: partyName ?? this.partyName,
    );
  }
}
