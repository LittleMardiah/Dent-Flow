import 'package:flutter/material.dart';
import '../models/invoice_model.dart';
import '../services/invoice_api_service.dart';

class InvoiceProvider extends ChangeNotifier {
  final InvoiceApiService _apiService = InvoiceApiService();

  List<Invoice> _invoices = [];
  Invoice? _selectedInvoice;
  bool _isLoading = false;
  String? _errorMessage;
  String? _paymentUrl;

  List<Invoice> get invoices => _invoices;
  Invoice? get selectedInvoice => _selectedInvoice;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get paymentUrl => _paymentUrl;

  // Filter by status
  List<Invoice> get unpaidInvoices =>
      _invoices.where((inv) => inv.isUnpaid).toList();
  List<Invoice> get paidInvoices =>
      _invoices.where((inv) => inv.isPaid).toList();

  Future<void> loadInvoices(String patientId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _invoices = await _apiService.getPatientInvoices(patientId);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadInvoiceDetail(String invoiceId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _selectedInvoice = await _apiService.getInvoiceDetail(invoiceId);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> payInvoice(String invoiceId) async {
    _isLoading = true;
    _errorMessage = null;
    _paymentUrl = null;
    notifyListeners();

    try {
      final result = await _apiService.payInvoice(invoiceId);
      _paymentUrl = result['paymentUrl'] ?? result['payment_url'];
      if (_paymentUrl == null) {
        throw Exception('Payment URL not found');
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  // Refresh invoice list (after payment)
  Future<void> refreshInvoices(String patientId) async {
    await loadInvoices(patientId);
  }

  void clearSelectedInvoice() {
    _selectedInvoice = null;
    notifyListeners();
  }

  void clearPaymentUrl() {
    _paymentUrl = null;
    notifyListeners();
  }

  void reset() {
    _invoices = [];
    _selectedInvoice = null;
    _isLoading = false;
    _errorMessage = null;
    _paymentUrl = null;
    notifyListeners();
  }
}
