class Doctor {
  final String id;
  final String fullName;
  final String specialization;
  final String branchId;
  final String? licenseNumber;

  Doctor({
    required this.id,
    required this.fullName,
    required this.specialization,
    required this.branchId,
    this.licenseNumber,
  });

  factory Doctor.fromJson(Map<String, dynamic> json) {
    return Doctor(
      id: json['id'] ?? '',
      fullName: json['fullName'] ?? json['full_name'] ?? '',
      specialization: json['specialization'] ?? json['spesialisasi'] ?? '',
      branchId: json['branchId'] ?? json['branch_id'] ?? '',
      licenseNumber: json['licenseNumber'] ?? json['license_number'],
    );
  }
}
