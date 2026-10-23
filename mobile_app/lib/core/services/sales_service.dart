import '../../models/sale.dart';
import '../../models/sale_return.dart';
import '../config/api_config.dart';
import 'api_client.dart';

class SalesService {
  final ApiClient _apiClient = ApiClient();

  Future<Sale> createSale({
    String? customerId,
    String? customerName,
    String? customerPhone,
    required double amount,
    double? amountReceived,
    String paymentMethod = 'CASH',
    List<Map<String, dynamic>>? items,
    double discount = 0,
    double tax = 0,
    String notes = '',
    String? idempotencyKey,
  }) async {
    final payload = <String, dynamic>{
      'amount': amount,
      'grandTotal': amount,
      'paymentMethod': paymentMethod,
      'discount': discount,
      'tax': tax,
      'notes': notes,
    };

    if (customerId != null && customerId.isNotEmpty) {
      payload['customer'] = customerId;
    }
    if (customerName != null && customerName.isNotEmpty) {
      payload['customerName'] = customerName;
    }
    if (customerPhone != null && customerPhone.isNotEmpty) {
      payload['customerPhone'] = customerPhone;
    }
    if (amountReceived != null) {
      payload['amountReceived'] = amountReceived;
    }
    if (items != null && items.isNotEmpty) {
      payload['items'] = items;
    }
    if (idempotencyKey != null && idempotencyKey.isNotEmpty) {
      payload['idempotencyKey'] = idempotencyKey;
    }

    final res = await _apiClient.post(ApiConfig.sales, payload);
    return Sale.fromJson(res as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> returnSale({
    required String saleId,
    required double returnAmount,
    List<Map<String, dynamic>>? returnedItems,
    String reason = 'Customer return',
    String? refundMode,
    bool restoreStock = true,
    String? idempotencyKey,
  }) async {
    final payload = <String, dynamic>{
      'returnAmount': returnAmount,
      'reason': reason,
      'restoreStock': restoreStock,
    };
    if (returnedItems != null && returnedItems.isNotEmpty) {
      payload['returnedItems'] = returnedItems;
    }
    if (refundMode != null) {
      payload['refundMode'] = refundMode;
    }
    if (idempotencyKey != null && idempotencyKey.isNotEmpty) {
      payload['idempotencyKey'] = idempotencyKey;
    }

    final res = await _apiClient.post('${ApiConfig.sales}/$saleId/return', payload);
    final map = res as Map<String, dynamic>;
    final saleReturn = SaleReturn.fromJson(map['return'] as Map<String, dynamic>);
    final updatedSale = Sale.fromJson(map['sale'] as Map<String, dynamic>);

    return {
      'return': saleReturn,
      'sale': updatedSale,
    };
  }

  Future<void> deleteSale(String saleId) async {
    await _apiClient.delete('${ApiConfig.sales}/$saleId');
  }

  Future<Sale> cancelSale(String saleId, {String? reason}) async {
    final payload = <String, dynamic>{};
    if (reason != null && reason.trim().isNotEmpty) {
      payload['reason'] = reason.trim();
    }
    final res = await _apiClient.put(
      '${ApiConfig.sales}/$saleId/cancel',
      payload.isNotEmpty ? payload : null,
    );
    final map = res as Map<String, dynamic>;
    return Sale.fromJson(map['sale'] as Map<String, dynamic>);
  }

  Future<void> deleteSaleReturn(String returnId) async {
    await _apiClient.delete('${ApiConfig.sales}/returns/$returnId');
  }

  Future<Sale> updateSale(String saleId, Map<String, dynamic> data) async {
    final res = await _apiClient.put('${ApiConfig.sales}/$saleId', data);
    final map = res as Map<String, dynamic>;
    return Sale.fromJson(map['sale'] as Map<String, dynamic>);
  }
}
