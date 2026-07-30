class InvoiceItem {
  final String label;
  final double amount;

  InvoiceItem({required this.label, required this.amount});

  factory InvoiceItem.fromJson(Map<String, dynamic> json) => InvoiceItem(
    label: json['label'] ?? '',
    amount: (json['amount'] ?? 0).toDouble(),
  );

  Map<String, dynamic> toJson() => {'label': label, 'amount': amount};
}

class Invoice {
  final String id;
  final String invoiceNumber;
  final String bookingId;
  final String patientId;
  final String doctorName;
  final String branchName;
  final double amountDue;
  final double amountPaid;
  final String status; // UNPAID, PAID, PARTIAL
  final String? paymentMethod;
  final DateTime? paidAt;
  final List<InvoiceItem> items;
  final DateTime createdAt;

  Invoice({
    required this.id,
    required this.invoiceNumber,
    required this.bookingId,
    required this.patientId,
    required this.doctorName,
    required this.branchName,
    required this.amountDue,
    required this.amountPaid,
    required this.status,
    this.paymentMethod,
    this.paidAt,
    required this.items,
    required this.createdAt,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] ?? json['items'] ?? [];
    return Invoice(
      id: json['id'] ?? '',
      invoiceNumber: json['invoiceNumber'] ?? json['invoice_number'] ?? '',
      bookingId: json['bookingId'] ?? json['booking_id'] ?? '',
      patientId: json['patientId'] ?? json['patient_id'] ?? '',
      doctorName: json['doctorName'] ?? json['doctor_name'] ?? '',
      branchName: json['branchName'] ?? json['branch_name'] ?? '',
      amountDue: (json['amountDue'] ?? json['amount_due'] ?? 0).toDouble(),
      amountPaid: (json['amountPaid'] ?? json['amount_paid'] ?? 0).toDouble(),
      status: json['status'] ?? 'UNPAID',
      paymentMethod: json['paymentMethod'] ?? json['payment_method'],
      paidAt: json['paidAt'] != null ? DateTime.parse(json['paidAt']) : null,
      items: itemsJson.map((i) => InvoiceItem.fromJson(i)).toList(),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  bool get isPaid => status == 'PAID';
  bool get isUnpaid => status == 'UNPAID';

  String get statusLabel {
    switch (status) {
      case 'UNPAID':
        return 'Belum Dibayar';
      case 'PAID':
        return 'Sudah Dibayar';
      case 'PARTIAL':
        return 'Sebagian Dibayar';
      default:
        return status;
    }
  }
}
