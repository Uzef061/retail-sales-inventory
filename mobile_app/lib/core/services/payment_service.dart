import '../config/api_config.dart';
import '../../models/payment_transaction.dart';
import 'api_client.dart';

class PaymentService {
  final ApiClient _apiClient = ApiClient();

  Future<List<PaymentTransaction>> getPayments({
    String? type,
    String? partyType,
    String? search,
  }) async {
    final queryParams = <String, String>{};
    if (type != null) queryParams['type'] = type;
    if (partyType != null) queryParams['partyType'] = partyType;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    String endpoint = ApiConfig.payments;
    if (queryParams.isNotEmpty) {
      final queryString = Uri(queryParameters: queryParams).query;
      endpoint = '$endpoint?$queryString';
    }

    final response = await _apiClient.get(endpoint);
    if (response is List) {
      return response
          .map((item) => PaymentTransaction.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<PaymentTransaction>> getTransactions({
    String? type,
    String? partyType,
    String? search,
  }) => getPayments(type: type, partyType: partyType, search: search);

  Future<PaymentSummary> getSummary() async {
    final response = await _apiClient.get(ApiConfig.paymentsSummary);
    if (response is Map) {
      return PaymentSummary.fromJson(Map<String, dynamic>.from(response));
    }
    return const PaymentSummary();
  }

  Future<PaymentTransaction> createPayment({
    required String type,
    required String partyName,
    required double amount,
    String? partyType,
    String? partyId,
    String paymentMethod = 'CASH',
    DateTime? transactionDate,
    String? referenceNumber,
    String? notes,
    String? idempotencyKey,
  }) async {
    final payload = <String, dynamic>{
      'type': type,
      'partyName': partyName,
      'amount': amount,
      'partyType': partyType ?? (type == 'RECEIVE' ? 'CUSTOMER' : 'SUPPLIER'),
      if (partyId != null) 'partyId': partyId,
      'paymentMethod': paymentMethod,
      'transactionDate': (transactionDate ?? DateTime.now()).toIso8601String(),
      if (referenceNumber != null) 'referenceNumber': referenceNumber,
      if (notes != null) 'notes': notes,
      if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
    };

    final response = await _apiClient.post(ApiConfig.payments, payload);
    return PaymentTransaction.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<void> deletePayment(String id) async {
    await _apiClient.delete('${ApiConfig.payments}/$id');
  }
}
