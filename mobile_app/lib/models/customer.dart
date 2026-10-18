class Customer {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String address;
  final bool isActive;

  Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    this.address = '',
    this.isActive = true,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      isActive: json['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'address': address,
      'isActive': isActive,
    };
  }
}
