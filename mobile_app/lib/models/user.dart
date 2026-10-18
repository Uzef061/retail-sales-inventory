class User {
  final String id;
  final String username;
  final String name;
  final String role; // 'ADMIN' or 'CASHIER'

  User({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
  });

  bool get isAdmin => role.toUpperCase() == 'ADMIN';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      name: json['name']?.toString() ?? json['username']?.toString() ?? 'User',
      role: json['role']?.toString().toUpperCase() ?? 'ADMIN',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'name': name,
      'role': role,
    };
  }
}
