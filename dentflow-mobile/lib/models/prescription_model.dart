class Prescription {
  final String id;
  final String medicationName;
  final String dosage;
  final String frequency;
  final String notes;
  final bool isActive;

  Prescription({
    required this.id,
    required this.medicationName,
    required this.dosage,
    required this.frequency,
    required this.notes,
    required this.isActive,
  });

  factory Prescription.fromJson(Map<String, dynamic> json) {
    return Prescription(
      id: json['id'] ?? '',
      medicationName: json['medicationName'] ?? json['medication'] ?? '',
      dosage: json['dosage'] ?? '',
      frequency: json['frequency'] ?? '',
      notes: json['notes'] ?? '',
      isActive: json['isActive'] ?? json['is_active'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'medicationName': medicationName,
      'dosage': dosage,
      'frequency': frequency,
      'notes': notes,
      'isActive': isActive,
    };
  }
}
