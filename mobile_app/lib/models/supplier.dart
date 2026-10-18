class Supplier {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String address;
  final String contactPerson;
  final bool isActive;

  Supplier({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    this.address = '',
    this.contactPerson = '',
    this.isActive = true,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      contactPerson: json['contactPerson']?.toString() ?? json['companyName']?.toString() ?? '',
      isActive: json['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'address': address,
      'contactPerson': contactPerson,
      'isActive': isActive,
    };
  }
}
