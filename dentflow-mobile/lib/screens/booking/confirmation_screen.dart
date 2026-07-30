import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/booking_provider.dart';

class ConfirmationScreen extends StatelessWidget {
  const ConfirmationScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.check_circle, size: 80, color: Colors.green),
          const SizedBox(height: 24),
          const Text('Booking Berhasil! 🎉', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Janji temu Anda telah dikonfirmasi', style: TextStyle(fontSize: 16, color: Colors.grey)),
          const SizedBox(height: 32),
          Card(elevation: 2, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Detail Booking', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              _row('ID Booking', p.bookingId ?? '-'),
              _row('Dokter', p.selectedDoctor?.fullName ?? '-'),
              _row('Cabang', p.selectedBranch?.name ?? '-'),
              _row('Tanggal', p.selectedDate != null ? '${p.selectedDate!.day} ${_month(p.selectedDate!.month)} ${p.selectedDate!.year}' : '-'),
              _row('Waktu', p.selectedSlot?.timeDisplay ?? '-'),
            ]),
          )),
          const SizedBox(height: 16),
          Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)),
            child: const Row(children: [Icon(Icons.sms, color: Colors.blue), SizedBox(width: 8),
              Expanded(child: Text('SMS konfirmasi telah dikirim ke nomor Anda', style: TextStyle(fontSize: 12))),
            ]),
          ),
          const Spacer(),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () { p.reset(); Navigator.popUntil(context, (route) => route.isFirst); },
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
            child: const Text('Kembali ke Home', style: TextStyle(fontSize: 16)),
          )),
        ])),
      ),
    );
  }
  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      SizedBox(width: 100, child: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 14))),
      Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14))),
    ]),
  );
  String _month(int m) => ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m-1];
}
