class WalkInResponse {
  final String tempPatientId;
  final int queueNumber;
  final String checkInCode;
  final int estimatedWaitTime;
  final String doctorName;
  final String branchName;
  final String status; // WAITING, BEING_CALLED, COMPLETED
  final String message;

  WalkInResponse({
    required this.tempPatientId,
    required this.queueNumber,
    required this.checkInCode,
    required this.estimatedWaitTime,
    required this.doctorName,
    required this.branchName,
    required this.status,
    required this.message,
  });

  factory WalkInResponse.fromJson(Map<String, dynamic> json) {
    return WalkInResponse(
      tempPatientId: json['tempPatientId'] ?? json['temp_patient_id'] ?? '',
      queueNumber: json['queueNumber'] ?? json['queue_number'] ?? 0,
      checkInCode: json['checkInCode'] ?? json['check_in_code'] ?? '',
      estimatedWaitTime: json['estimatedWaitTime'] ?? json['estimated_wait_time'] ?? 0,
      doctorName: json['doctorName'] ?? json['doctor_name'] ?? '',
      branchName: json['branchName'] ?? json['branch_name'] ?? '',
      status: json['status'] ?? 'WAITING',
      message: json['message'] ?? '',
    );
  }

  bool get isWaiting => status == 'WAITING';
  bool get isBeingCalled => status == 'BEING_CALLED';
  bool get isCompleted => status == 'COMPLETED';
}
