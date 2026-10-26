import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';

import '../../providers/booking_provider.dart';
import '../../providers/websocket_provider.dart';

class SelectTimeScreen extends StatefulWidget {
  const SelectTimeScreen({super.key});

  @override
  State<SelectTimeScreen> createState() => _SelectTimeScreenState();
}

class _SelectTimeScreenState extends State<SelectTimeScreen> {
  DateTime _date = DateTime.now();
  Timer? _timer;
  String? _branchId;

  static const rose = Color(0xFFD08080);

  @override
  void initState() {
    super.initState();

    final bookingProvider =
        Provider.of<BookingProvider>(context, listen: false);
    _branchId = bookingProvider.selectedBranch?.id ?? 'A';

    final wsProvider = Provider.of<WebSocketProvider>(context, listen: false);
    if (_branchId != null && _branchId!.isNotEmpty) {
      wsProvider.subscribeSlot(_branchId!);
    }

    _loadSlots(_date);
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) {
        final provider = Provider.of<BookingProvider>(context, listen: false);
        if (provider.selectedDoctor != null) {
          provider.loadSlots(_date);
        }
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    if (_branchId != null && _branchId!.isNotEmpty) {
      final wsProvider = Provider.of<WebSocketProvider>(context, listen: false);
      wsProvider.unsubscribeSlot(_branchId!);
    }
    super.dispose();
  }

  void _loadSlots(DateTime d) async {
    setState(() => _date = d);
    final provider = Provider.of<BookingProvider>(context, listen: false);
    if (provider.selectedDoctor != null) {
      await provider.loadSlots(d);
    }
  }

  String _label(DateTime d) {
    final now = DateTime.now();
    if (d.year == now.year && d.month == now.month && d.day == now.day) {
      return 'Hari Ini';
    }
    if (d.difference(now).inDays == 1) {
      return 'Besok';
    }
    return '';
  }

  Widget _buildShimmer() {
    return Expanded(
      child: ListView.builder(
        itemCount: 4,
        itemBuilder: (_, __) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Shimmer.fromColors(
              baseColor: Colors.grey.shade300,
              highlightColor: Colors.grey.shade100,
              child: Container(
                height: 72,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Pilih Tanggal & Waktu',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Pilih tanggal dan sesi yang tersedia',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 56,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: 7,
              itemBuilder: (_, i) {
                final d = DateTime.now().add(Duration(days: i));
                final sel = d.year == _date.year &&
                    d.month == _date.month &&
                    d.day == _date.day;
                final label = _label(d);
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => _loadSlots(d),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        gradient: sel
                            ? const LinearGradient(
                                colors: [Color(0xFFD08080), Color(0xFF8F4A4B)],
                                begin: Alignment.centerLeft,
                                end: Alignment.centerRight,
                              )
                            : null,
                        color: sel ? null : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: sel ? Colors.transparent : Colors.grey.shade200,
                          width: 1.5,
                        ),
                        boxShadow: sel
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF8F4A4B)
                                      .withValues(alpha: 0.18),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                )
                              ]
                            : null,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            label.isNotEmpty ? label : '${d.day}',
                            style: TextStyle(
                              color: sel ? Colors.white : Colors.black87,
                              fontWeight: sel ? FontWeight.bold : FontWeight.w600,
                            ),
                          ),
                          if (label.isEmpty)
                            Text(
                              _getMonth(d.month),
                              style: TextStyle(
                                fontSize: 10,
                                color: sel ? Colors.white70 : Colors.grey,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          if (p.isLoading)
            _buildShimmer()
          else if (p.slots.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('Tidak ada slot tersedia'),
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                itemCount: p.slots.length,
                itemBuilder: (_, i) {
                  final s = p.slots[i];
                  final sel = p.selectedSlot?.id == s.id;
                  final available = s.isAvailable;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: sel && available
                            ? [
                                BoxShadow(
                                  color: rose.withValues(alpha: 0.2),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                )
                              ]
                            : null,
                      ),
                      child: Card(
                        elevation: 0,
                        margin: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(
                            color: sel && available
                                ? rose
                                : available
                                    ? Colors.grey.shade200
                                    : Colors.grey.shade300.withValues(alpha: 0.6),
                            width: sel && available ? 2.2 : 1,
                          ),
                        ),
                        child: Opacity(
                          opacity: available ? 1.0 : 0.5,
                          child: ListTile(
                            enabled: available,
                            leading: CircleAvatar(
                              backgroundColor: available
                                  ? rose.withValues(alpha: 0.16)
                                  : Colors.grey.shade200,
                              child: Icon(
                                available ? Icons.access_time_rounded : Icons.block,
                                color: available ? rose : Colors.grey,
                                size: 20,
                              ),
                            ),
                            title: Text(
                              s.timeDisplay,
                              style: TextStyle(
                                fontWeight:
                                    sel && available ? FontWeight.w700 : FontWeight.w600,
                                color: available ? Colors.black87 : Colors.grey,
                              ),
                            ),
                            subtitle: Text(
                              available
                                  ? '${s.availableSpots} slot tersedia'
                                  : 'Penuh',
                              style: TextStyle(
                                color: available ? rose : Colors.grey,
                                fontSize: 12,
                              ),
                            ),
                            trailing: sel && available
                                ? const Icon(Icons.check_circle_rounded, color: rose)
                                : available
                                    ? Icon(Icons.chevron_right_rounded,
                                        color: Colors.grey.shade400)
                                    : null,
                            onTap: available
                                ? () {
                                    p.setSlot(s);
                                    p.nextStep();
                                  }
                                : null,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  String _getMonth(int m) {
    const months = [
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
    ];
    return months[m - 1];
  }
}
