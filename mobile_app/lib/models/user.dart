class User {
  final String id;
  final String username;
  final String name;
  final String role; // 'ADMIN' or 'CASHIER'
  final String? email;
  final String? avatar;
  final bool hasCompletedOnboarding;
  final String? businessId;

  User({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    this.email,
    this.avatar,
    this.hasCompletedOnboarding = true,
    this.businessId,
  });

  bool get isAdmin => role.toUpperCase() == 'ADMIN';

  factory User.fromJson(Map<String, dynamic> json) {
    final rawOnboarding = json['hasCompletedOnboarding'];
    final username = json['username']?.toString() ?? '';
    final isBuiltInAdmin = username.toLowerCase() == 'admin' || username.toLowerCase() == 'cashier';
    final bool onboarded = isBuiltInAdmin || (rawOnboarding != false);

    return User(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      username: username,
      name: json['name']?.toString() ?? (username.isNotEmpty ? username : 'User'),
      role: json['role']?.toString().toUpperCase() ?? 'ADMIN',
      email: json['email']?.toString(),
      avatar: json['avatar']?.toString(),
      hasCompletedOnboarding: onboarded,
      businessId: json['businessId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'name': name,
      'role': role,
      'email': email,
      'avatar': avatar,
      'hasCompletedOnboarding': hasCompletedOnboarding,
      'businessId': businessId,
    };
  }
}
