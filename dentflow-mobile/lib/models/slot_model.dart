class Slot {
  final String id;
  final String startTime;
  final String endTime;
  final int availableSpots;
  final int maxSpots;
  Slot({required this.id, required this.startTime, required this.endTime, required this.availableSpots, required this.maxSpots});
  factory Slot.fromJson(Map<String, dynamic> json) => Slot(
    id: json['id'] ?? json['slotId'] ?? '',
    startTime: json['startTime'] ?? json['start_time'] ?? '',
    endTime: json['endTime'] ?? json['end_time'] ?? '',
    availableSpots: json['availableSpots'] ?? json['available_spots'] ?? 0,
    maxSpots: json['maxSpots'] ?? json['max_spots'] ?? 4,
  );
  bool get isAvailable => availableSpots > 0;
  String get timeDisplay => '$startTime - $endTime';
}
