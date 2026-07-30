class Doctor {
  final String id;
  final String fullName;
  final String specialization;
  final String branchId;
  final bool isAvailable;
  Doctor({required this.id, required this.fullName, required this.specialization, required this.branchId, this.isAvailable = true});
  factory Doctor.fromJson(Map<String, dynamic> json) => Doctor(
    id: json['id'] ?? '',
    fullName: json['fullName'] ?? json['full_name'] ?? '',
    specialization: json['specialization'] ?? json['spesialisasi'] ?? '',
    branchId: json['branchId'] ?? json['branch_id'] ?? '',
    isAvailable: json['isAvailable'] ?? json['is_available'] ?? true,
  );
}
