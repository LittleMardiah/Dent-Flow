class QueuePatient {
  final String id;
  final String patientId;
  final String patientName;
  final int queueNumber;
  final String status; // WAITING, BEING_CALLED, IN_SERVICE, COMPLETED
  final String? triage;
  final int? estimatedWaitTime;
  final DateTime checkInTime;

  QueuePatient({
    required this.id,
    required this.patientId,
    required this.patientName,
    required this.queueNumber,
    required this.status,
    this.triage,
    this.estimatedWaitTime,
    required this.checkInTime,
  });

  factory QueuePatient.fromJson(Map<String, dynamic> json) {
    return QueuePatient(
      id: json['id'] ?? '',
      patientId: json['patientId'] ?? json['patient_id'] ?? '',
      patientName: json['patientName'] ?? json['patient_name'] ?? '',
      queueNumber: json['queueNumber'] ?? json['queue_number'] ?? 0,
      status: json['status'] ?? 'WAITING',
      triage: json['triage'] ?? json['triage'],
      estimatedWaitTime: json['estimatedWaitTime'] ?? json['estimated_wait_time'],
      checkInTime: json['checkInTime'] != null ? DateTime.parse(json['checkInTime']) : DateTime.now(),
    );
  }

  bool get isWaiting => status == 'WAITING';
  bool get isBeingCalled => status == 'BEING_CALLED';
  bool get isInService => status == 'IN_SERVICE';
  bool get isCompleted => status == 'COMPLETED';

  String get statusLabel {
    switch (status) {
      case 'WAITING': return 'Menunggu';
      case 'BEING_CALLED': return 'Dipanggil';
      case 'IN_SERVICE': return 'Dalam Pelayanan';
      case 'COMPLETED': return 'Selesai';
      default: return status;
    }
  }
}
