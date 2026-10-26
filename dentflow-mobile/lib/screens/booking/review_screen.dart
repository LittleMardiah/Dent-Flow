import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/widgets/premium_button.dart';
import '../../providers/booking_provider.dart';

class ReviewScreen extends StatelessWidget {
  const ReviewScreen({super.key});

  static const rose = Color(0xFFD08080);

  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    final b = p.selectedBranch;
    final d = p.selectedDoctor;
    final s = p.selectedSlot;
    final dt = p.selectedDate;
    if (b == null || d == null || s == null || dt == null) {
      return const Center(child: Text('Data tidak lengkap'));
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Review Booking',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Periksa kembali detail booking Anda',
              style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: rose.withValues(alpha: 0.12),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Card(
              elevation: 0,
              margin: EdgeInsets.zero,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: rose.withValues(alpha: 0.25), width: 1),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 16),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFFD08080), Color(0xFF8F4A4B)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.receipt_long_rounded, color: Colors.white),
                          SizedBox(width: 10),
                          Text(
                            'Struk Digital Booking',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 16),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        children: [
                          _rowReceipt(Icons.location_on_outlined, 'Cabang', b.name),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Divider(height: 1),
                          ),
                          _rowReceipt(
                              Icons.medical_services_outlined, 'Dokter', d.fullName),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Divider(height: 1),
                          ),
                          _rowReceipt(Icons.badge_outlined, 'Spesialis',
                              d.specialization),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Divider(height: 1),
                          ),
                          _rowReceipt(Icons.calendar_today_outlined, 'Tanggal',
                              '${dt.day} ${_month(dt.month)} ${dt.year}'),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Divider(height: 1),
                          ),
                          _rowReceipt(
                              Icons.access_time_rounded, 'Jam', s.timeDisplay),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Divider(height: 1),
                          ),
                          _rowReceipt(
                              Icons.payments_outlined, 'Harga', 'Rp 50.000 (DP)'),
                        ],
                      ),
                    ),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 18, vertical: 12),
                      decoration: BoxDecoration(
                        color: rose.withValues(alpha: 0.08),
                        border: Border(
                          top: BorderSide(color: rose.withValues(alpha: 0.18)),
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Total Pembayaran (DP)',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            'Rp 50.000',
                            style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: Color(0xFF8F4A4B)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange.shade300)),
            child: const Row(children: [
              Icon(Icons.info_outline, color: Colors.orange),
              SizedBox(width: 8),
              Expanded(
                  child: Text(
                      '⚠️ DP bersifat non-refundable (tidak dapat dikembalikan)',
                      style: TextStyle(fontSize: 12))),
            ]),
          ),
          const Spacer(),
          if (p.errorMessage != null)
            Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(p.errorMessage!,
                    style: const TextStyle(color: Colors.red))),
          PremiumButton(
            text: 'Bayar Sekarang',
            isLoading: p.isLoading,
            onPressed: () {
              if (!p.isLoading) {
                p.submitBooking().then((_) {
                  p.nextStep();
                }).catchError((error) {
                  // Log error atau handle di provider
                  print('Error: \$error');
                });
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _rowReceipt(IconData icon, String label, String value) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: rose.withValues(alpha: 0.14),
            ),
            child: Icon(icon, size: 18, color: const Color(0xFF8F4A4B)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 2),
                Text(value,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
              ],
            ),
          ),
        ],
      );

  String _month(int m) => [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Agu',
        'Sep',
        'Okt',
        'Nov',
        'Des'
      ][m - 1];
}
