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
  final String currencyCode;
  final String currencySymbol;
  final String currencyName;
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
    this.currency = 'INR',
    this.currencyCode = 'INR',
    this.currencySymbol = '₹',
    this.currencyName = 'Indian Rupee',
    this.taxNumber = '',
    this.logoUrl = '',
    this.receiptHeader = '',
    this.receiptFooter = 'Thank you for your business!',
  });

  factory BusinessProfile.fromJson(Map<String, dynamic> json) {
    final rawCurrency = json['currency']?.toString() ?? 'INR';
    final code = json['currencyCode']?.toString() ?? (rawCurrency.isNotEmpty ? rawCurrency : 'INR');
    final symbol = json['currencySymbol']?.toString() ?? '';
    final name = json['currencyName']?.toString() ?? '';

    return BusinessProfile(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      businessName: json['businessName']?.toString() ?? 'My Store',
      ownerName: json['ownerName']?.toString() ?? '',
      category: json['category']?.toString() ?? 'General Retail',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      currency: rawCurrency,
      currencyCode: code,
      currencySymbol: symbol,
      currencyName: name,
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
      'currencyCode': currencyCode,
      'currencySymbol': currencySymbol,
      'currencyName': currencyName,
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
    String? currencyCode,
    String? currencySymbol,
    String? currencyName,
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
      currencyCode: currencyCode ?? this.currencyCode,
      currencySymbol: currencySymbol ?? this.currencySymbol,
      currencyName: currencyName ?? this.currencyName,
      taxNumber: taxNumber ?? this.taxNumber,
      logoUrl: logoUrl ?? this.logoUrl,
      receiptHeader: receiptHeader ?? this.receiptHeader,
      receiptFooter: receiptFooter ?? this.receiptFooter,
    );
  }
}
