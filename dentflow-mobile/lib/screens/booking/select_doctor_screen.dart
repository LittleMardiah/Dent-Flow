import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/booking_provider.dart';

class SelectDoctorScreen extends StatefulWidget {
  const SelectDoctorScreen({super.key});
  @override
  State<SelectDoctorScreen> createState() => _SelectDoctorScreenState();
}
class _SelectDoctorScreenState extends State<SelectDoctorScreen> {
  String _query = '';
  String _spec = 'Semua';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) =>
      Provider.of<BookingProvider>(context, listen: false).loadDoctors());
  }
  List<String> get specs {
    final p = Provider.of<BookingProvider>(context, listen: false);
    final s = p.doctors.map((d) => d.specialization).where((s) => s.isNotEmpty).toSet().toList();
    return ['Semua', ...s];
  }
  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    final filtered = p.doctors.where((d) =>
      d.fullName.toLowerCase().contains(_query.toLowerCase()) ||
      d.specialization.toLowerCase().contains(_query.toLowerCase())
    ).where((d) => _spec == 'Semua' || d.specialization == _spec).toList();
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Pilih Dokter', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Cari dokter atau filter spesialisasi', style: TextStyle(fontSize: 14, color: Colors.grey)),
        const SizedBox(height: 12),
        TextField(
          decoration: InputDecoration(hintText: 'Cari dokter...', prefixIcon: const Icon(Icons.search),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
          onChanged: (v) => setState(() => _query = v),
        ),
        const SizedBox(height: 12),
        SizedBox(height: 40, child: ListView.builder(
          scrollDirection: Axis.horizontal,
          itemCount: specs.length,
          itemBuilder: (_, i) {
            final s = specs[i]; final sel = s == _spec;
            return Padding(padding: const EdgeInsets.only(right: 8),
              child: FilterChip(label: Text(s), selected: sel,
                onSelected: (selected) => setState(() => _spec = selected ? s : 'Semua')),
            );
          },
        )),
        const SizedBox(height: 12),
        if (p.isLoading) const Center(child: CircularProgressIndicator())
        else if (filtered.isEmpty) const Center(child: Text('Tidak ada dokter'))
        else Expanded(
          child: ListView.builder(
            itemCount: filtered.length,
            itemBuilder: (_, i) {
              final d = filtered[i]; final sel = p.selectedDoctor?.id == d.id;
              return Card(
                elevation: sel ? 4 : 1,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: sel ? Colors.blue : Colors.transparent, width: 2)),
                child: ListTile(
                  leading: CircleAvatar(backgroundColor: Colors.blue.shade100,
                    child: Text(d.fullName.substring(0,1), style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue))),
                  title: Text(d.fullName, style: TextStyle(fontWeight: sel ? FontWeight.bold : FontWeight.normal)),
                  subtitle: Text(d.specialization),
                  trailing: sel ? const Icon(Icons.check_circle, color: Colors.blue) : null,
                  onTap: () { p.setDoctor(d); p.nextStep(); },
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}
