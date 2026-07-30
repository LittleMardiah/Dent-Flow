class Branch {
  final String id;
  final String name;
  final String address;
  final String phone;
  Branch({required this.id, required this.name, required this.address, required this.phone});
  factory Branch.fromJson(Map<String, dynamic> json) => Branch(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    address: json['address'] ?? '',
    phone: json['phone'] ?? '',
  );
}
