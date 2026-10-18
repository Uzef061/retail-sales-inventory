import '../config/api_config.dart';
import '../../models/business_profile.dart';
import 'api_client.dart';

class BusinessService {
  final ApiClient _apiClient = ApiClient();

  Future<BusinessProfile> getProfile() async {
    final response = await _apiClient.get(ApiConfig.businessProfile);
    if (response is Map && response['profile'] is Map) {
      return BusinessProfile.fromJson(Map<String, dynamic>.from(response['profile'] as Map));
    }
    return BusinessProfile(
      id: '',
      userId: '',
      businessName: 'My Store',
    );
  }

  Future<BusinessProfile> updateProfile({
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
    BusinessProfile? profile,
  }) async {
    final payload = profile != null
        ? profile.toJson()
        : {
            if (businessName != null) 'businessName': businessName,
            if (ownerName != null) 'ownerName': ownerName,
            if (category != null) 'category': category,
            if (phone != null) 'phone': phone,
            if (email != null) 'email': email,
            if (address != null) 'address': address,
            if (currency != null) 'currency': currency,
            if (taxNumber != null) 'taxNumber': taxNumber,
            if (logoUrl != null) 'logoUrl': logoUrl,
            if (receiptHeader != null) 'receiptHeader': receiptHeader,
            if (receiptFooter != null) 'receiptFooter': receiptFooter,
          };

    final response = await _apiClient.put(
      ApiConfig.businessProfile,
      payload,
    );
    if (response is Map && response['profile'] is Map) {
      return BusinessProfile.fromJson(Map<String, dynamic>.from(response['profile'] as Map));
    }
    if (profile != null) return profile;
    return getProfile();
  }
}
