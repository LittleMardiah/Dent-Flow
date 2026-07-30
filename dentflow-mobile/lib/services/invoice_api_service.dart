import '../models/invoice_model.dart';
import 'dio_client.dart';

class InvoiceApiService {
  final DioClient _dioClient = DioClient();

  Future<List<Invoice>> getPatientInvoices(String patientId) async {
    try {
      final response = await _dioClient.get('/patients/$patientId/invoices');
      final data = response.data['data'] ?? response.data;
      final List<dynamic> invoices = data['invoices'] ?? data ?? [];
      return invoices.map((json) => Invoice.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<Invoice> getInvoiceDetail(String invoiceId) async {
    try {
      final response = await _dioClient.get('/invoices/$invoiceId');
      final data = response.data['data'] ?? response.data;
      return Invoice.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> payInvoice(String invoiceId) async {
    try {
      final response = await _dioClient.post('/invoices/$invoiceId/pay');
      return response.data['data'] ?? response.data;
    } catch (e) {
      rethrow;
    }
  }
}
