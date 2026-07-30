class VitalSigns {
  String? bloodPressure;
  String? heartRate;
  String? temperature;
  String? weight;
  String? oxygenSaturation;

  VitalSigns({
    this.bloodPressure,
    this.heartRate,
    this.temperature,
    this.weight,
    this.oxygenSaturation,
  });

  Map<String, dynamic> toJson() {
    return {
      'bloodPressure': bloodPressure,
      'heartRate': heartRate,
      'temperature': temperature,
      'weight': weight,
      'oxygenSaturation': oxygenSaturation,
    };
  }

  bool get isComplete =>
      bloodPressure != null &&
      heartRate != null &&
      temperature != null &&
      weight != null;
}
