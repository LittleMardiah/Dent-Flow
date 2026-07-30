class Booking {
  final String id;
  final String bookingCode;
  final String doctorName;
  final String doctorSpecialization;
  final String branchName;
  final String date;
  final String timeStart;
  final String timeEnd;
  final String status;
  final String? queueNumber;

  Booking({
    required this.id,
    required this.bookingCode,
    required this.doctorName,
    required this.doctorSpecialization,
    required this.branchName,
    required this.date,
    required this.timeStart,
    required this.timeEnd,
    required this.status,
    this.queueNumber,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['id'] ?? '',
      bookingCode: json['bookingCode'] ?? json['booking_code'] ?? json['checkInCode'] ?? json['check_in_code'] ?? '',
      doctorName: json['doctorName'] ?? json['doctor_name'] ?? '',
      doctorSpecialization: json['doctorSpecialization'] ?? json['specialization'] ?? '',
      branchName: json['branchName'] ?? json['branch_name'] ?? '',
      date: json['date'] ?? '',
      timeStart: json['timeStart'] ?? json['session_start'] ?? '',
      timeEnd: json['timeEnd'] ?? json['session_end'] ?? '',
      status: json['status'] ?? 'PENDING',
      queueNumber: json['queueNumber']?.toString() ?? json['queue_number']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'bookingCode': bookingCode,
      'doctorName': doctorName,
      'doctorSpecialization': doctorSpecialization,
      'branchName': branchName,
      'date': date,
      'timeStart': timeStart,
      'timeEnd': timeEnd,
      'status': status,
      'queueNumber': queueNumber,
    };
  }

  String get statusLabel {
    switch (status) {
      case 'PENDING': return 'Menunggu Pembayaran';
      case 'PAYMENT_CONFIRMED': return 'Dikonfirmasi';
      case 'CHECKED_IN': return 'Sudah Check-in';
      case 'COMPLETED': return 'Selesai';
      case 'CANCELLED': return 'Dibatalkan';
      default: return status;
    }
  }

  bool get isUpcoming => status == 'PAYMENT_CONFIRMED' || status == 'CHECKED_IN';
}
