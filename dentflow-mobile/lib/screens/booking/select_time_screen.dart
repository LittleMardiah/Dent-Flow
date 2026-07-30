import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../../providers/booking_provider.dart';

class SelectTimeScreen extends StatefulWidget {
  const SelectTimeScreen({super.key});
  @override
  State<SelectTimeScreen> createState() => _SelectTimeScreenState();
}
class _SelectTimeScreenState extends State<SelectTimeScreen> {
  DateTime _date = DateTime.now();
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    _loadSlots(_date);
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) Provider.of<BookingProvider>(context, listen: false).loadSlots(_date);
    });
  }
  @override
  void dispose() { _timer?.cancel(); super.dispose(); }
  void _loadSlots(DateTime d) async {
    setState(() => _date = d);
    await Provider.of<BookingProvider>(context, listen: false).loadSlots(d);
  }
  String _label(DateTime d) {
    final now = DateTime.now();
    if (d.year == now.year && d.month == now.month && d.day == now.day) return 'Hari Ini';
    if (d.difference(now).inDays == 1) return 'Besok';
    return '';
  }
  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Pilih Tanggal & Waktu', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Pilih tanggal dan sesi yang tersedia', style: TextStyle(fontSize: 14, color: Colors.grey)),
        const SizedBox(height: 12),
        SizedBox(height: 50, child: ListView.builder(
          scrollDirection: Axis.horizontal,
          itemCount: 7,
          itemBuilder: (_, i) {
            final d = DateTime.now().add(Duration(days: i));
            final sel = d.year == _date.year && d.month == _date.month && d.day == _date.day;
            final label = _label(d);
            return Padding(padding: const EdgeInsets.only(right: 8),
              child: InkWell(
                onTap: () => _loadSlots(d),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: sel ? Colors.blue : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: sel ? Colors.blue : Colors.transparent, width: 2),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(label.isNotEmpty ? label : '${d.day}',
                      style: TextStyle(color: sel ? Colors.white : Colors.black87, fontWeight: sel ? FontWeight.bold : FontWeight.normal)),
                    if (label.isEmpty) Text(_getMonth(d.month), style: TextStyle(fontSize: 10, color: sel ? Colors.white70 : Colors.grey)),
                  ]),
                ),
              ),
            );
          },
        )),
        const SizedBox(height: 16),
        if (p.isLoading) const Center(child: CircularProgressIndicator())
        else if (p.slots.isEmpty) const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('Tidak ada slot tersedia')))
        else Expanded(
          child: ListView.builder(
            itemCount: p.slots.length,
            itemBuilder: (_, i) {
              final s = p.slots[i]; final sel = p.selectedSlot?.id == s.id;
              return Card(
                elevation: sel ? 4 : 1,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: sel ? Colors.blue : Colors.transparent, width: 2)),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: s.isAvailable ? Colors.green.shade100 : Colors.red.shade100,
                    child: Icon(s.isAvailable ? Icons.check : Icons.close, color: s.isAvailable ? Colors.green : Colors.red, size: 20),
                  ),
                  title: Text(s.timeDisplay),
                  subtitle: Text(s.isAvailable ? '${s.availableSpots} slot tersedia' : 'Penuh',
                    style: TextStyle(color: s.isAvailable ? Colors.green : Colors.red)),
                  trailing: sel ? const Icon(Icons.check_circle, color: Colors.blue) : null,
                  onTap: s.isAvailable ? () { p.setSlot(s); p.nextStep(); } : null,
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
  String _getMonth(int m) => ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m-1];
}
