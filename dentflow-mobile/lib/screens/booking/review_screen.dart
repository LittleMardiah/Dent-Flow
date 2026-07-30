import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/booking_provider.dart';

class ReviewScreen extends StatelessWidget {
  const ReviewScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    final b = p.selectedBranch; final d = p.selectedDoctor; final s = p.selectedSlot; final dt = p.selectedDate;
    if (b == null || d == null || s == null || dt == null) return const Center(child: Text('Data tidak lengkap'));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Review Booking', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Periksa kembali detail booking Anda', style: TextStyle(fontSize: 14, color: Colors.grey)),
        const SizedBox(height: 16),
        Card(
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              _row(Icons.location_on, 'Cabang', b.name),
              const Divider(), _row(Icons.health_and_safety, 'Dokter', d.fullName),
              const Divider(), _row(Icons.medical_services, 'Spesialis', d.specialization),
              const Divider(), _row(Icons.calendar_today, 'Tanggal', '${dt.day} ${_month(dt.month)} ${dt.year}'),
              const Divider(), _row(Icons.access_time, 'Waktu', s.timeDisplay),
              const Divider(), _row(Icons.attach_money, 'Biaya', 'Rp 50.000 (DP)'),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(
          color: Colors.orange.shade50, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.orange.shade300)),
          child: const Row(children: [
            Icon(Icons.info_outline, color: Colors.orange),
            SizedBox(width: 8),
            Expanded(child: Text('⚠️ DP bersifat non-refundable (tidak dapat dikembalikan)', style: TextStyle(fontSize: 12))),
          ]),
        ),
        const Spacer(),
        if (p.errorMessage != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(p.errorMessage!, style: const TextStyle(color: Colors.red))),
        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: p.isLoading ? null : () async { try { await p.submitBooking(); p.nextStep(); } catch (_) {} },
          style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
          child: p.isLoading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Konfirmasi Booking', style: TextStyle(fontSize: 16)),
        )),
      ]),
    );
  }
  Widget _row(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Icon(icon, size: 20, color: Colors.grey), const SizedBox(width: 12),
      Expanded(flex: 2, child: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 14))),
      Expanded(flex: 3, child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14))),
    ]),
  );
  String _month(int m) => ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m-1];
}
