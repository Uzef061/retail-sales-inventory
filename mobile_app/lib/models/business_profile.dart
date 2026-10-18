class BusinessProfile {
  final String id;
  final String userId;
  final String businessName;
  final String ownerName;
  final String category;
  final String phone;
  final String email;
  final String address;
  final String currency;
  final String taxNumber;
  final String logoUrl;
  final String receiptHeader;
  final String receiptFooter;

  BusinessProfile({
    required this.id,
    required this.userId,
    required this.businessName,
    this.ownerName = '',
    this.category = 'General Retail',
    this.phone = '',
    this.email = '',
    this.address = '',
    this.currency = 'PKR',
    this.taxNumber = '',
    this.logoUrl = '',
    this.receiptHeader = '',
    this.receiptFooter = 'Thank you for your business!',
  });

  factory BusinessProfile.fromJson(Map<String, dynamic> json) {
    return BusinessProfile(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      businessName: json['businessName']?.toString() ?? 'My Store',
      ownerName: json['ownerName']?.toString() ?? '',
      category: json['category']?.toString() ?? 'General Retail',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      currency: json['currency']?.toString() ?? 'PKR',
      taxNumber: json['taxNumber']?.toString() ?? '',
      logoUrl: json['logoUrl']?.toString() ?? '',
      receiptHeader: json['receiptHeader']?.toString() ?? '',
      receiptFooter: json['receiptFooter']?.toString() ?? 'Thank you for your business!',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'businessName': businessName,
      'ownerName': ownerName,
      'category': category,
      'phone': phone,
      'email': email,
      'address': address,
      'currency': currency,
      'taxNumber': taxNumber,
      'logoUrl': logoUrl,
      'receiptHeader': receiptHeader,
      'receiptFooter': receiptFooter,
    };
  }

  BusinessProfile copyWith({
    String? businessName,
    String? ownerName,
    String? category,
    String? phone,
    String? email,
    String? address,
    String? currency,
    String? taxNumber,
    String? logoUrl,
    String? receiptHeader,
    String? receiptFooter,
  }) {
    return BusinessProfile(
      id: id,
      userId: userId,
      businessName: businessName ?? this.businessName,
      ownerName: ownerName ?? this.ownerName,
      category: category ?? this.category,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      address: address ?? this.address,
      currency: currency ?? this.currency,
      taxNumber: taxNumber ?? this.taxNumber,
      logoUrl: logoUrl ?? this.logoUrl,
      receiptHeader: receiptHeader ?? this.receiptHeader,
      receiptFooter: receiptFooter ?? this.receiptFooter,
    );
  }
}
