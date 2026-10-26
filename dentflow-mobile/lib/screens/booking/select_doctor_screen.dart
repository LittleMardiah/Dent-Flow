import 'package:cached_network_image/cached_network_image.dart';
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
  final Set<String> _pressed = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) =>
        Provider.of<BookingProvider>(context, listen: false).loadDoctors());
  }

  List<String> get specs {
    final p = Provider.of<BookingProvider>(context, listen: false);
    final s = p.doctors
        .map((d) => d.specialization)
        .where((s) => s.isNotEmpty)
        .toSet()
        .toList();
    return ['Semua', ...s];
  }

  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    const rose = Color(0xFFD08080);
    final filtered = p.doctors
        .where((d) =>
            d.fullName.toLowerCase().contains(_query.toLowerCase()) ||
            d.specialization.toLowerCase().contains(_query.toLowerCase()))
        .where((d) => _spec == 'Semua' || d.specialization == _spec)
        .toList();

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Pilih Dokter',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Cari dokter atau filter spesialisasi',
              style: TextStyle(fontSize: 14, color: Colors.grey)),
          const SizedBox(height: 12),
          TextField(
            decoration: InputDecoration(
                hintText: 'Cari dokter...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12))),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 40,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: specs.length,
              itemBuilder: (_, i) {
                final s = specs[i];
                final sel = s == _spec;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(s),
                    selected: sel,
                    selectedColor: rose.withValues(alpha: 0.15),
                    checkmarkColor: rose,
                    side: BorderSide(color: sel ? rose : Colors.grey.shade300),
                    onSelected: (selected) =>
                        setState(() => _spec = selected ? s : 'Semua'),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          if (p.isLoading)
            const Center(child: CircularProgressIndicator())
          else if (filtered.isEmpty)
            const Center(child: Text('Tidak ada dokter'))
          else
            Expanded(
              child: ListView.builder(
                itemCount: filtered.length,
                itemBuilder: (_, i) {
                  final d = filtered[i];
                  final sel = p.selectedDoctor?.id == d.id;
                  final pressed = _pressed.contains(d.id);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AnimatedScale(
                      scale: pressed ? 0.98 : 1.0,
                      duration: const Duration(milliseconds: 120),
                      curve: Curves.easeInOut,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: sel
                              ? [
                                  BoxShadow(
                                    color: rose.withValues(alpha: 0.22),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  )
                                ]
                              : [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.02),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  )
                                ],
                        ),
                        child: Card(
                          elevation: 0,
                          margin: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(
                              color: sel ? rose : Colors.grey.shade200,
                              width: sel ? 2.2 : 1,
                            ),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTapDown: (_) => setState(() => _pressed.add(d.id)),
                            onTapCancel: () =>
                                setState(() => _pressed.remove(d.id)),
                            onTapUp: (_) => setState(() => _pressed.remove(d.id)),
                            onTap: () {
                              p.setDoctor(d);
                              p.nextStep();
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(40),
                                    child: SizedBox(
                                      width: 56,
                                      height: 56,
                                      child: d.photoUrl != null &&
                                              d.photoUrl!.isNotEmpty
                                          ? CachedNetworkImage(
                                              imageUrl: d.photoUrl!,
                                              fit: BoxFit.cover,
                                              placeholder: (_, __) => Container(
                                                color: rose.withValues(alpha: 0.12),
                                                child: const Icon(
                                                  Icons.person,
                                                  color: rose,
                                                ),
                                              ),
                                              errorWidget: (_, __, ___) => Container(
                                                color: rose.withValues(alpha: 0.12),
                                                child: const Icon(
                                                  Icons.person,
                                                  color: rose,
                                                ),
                                              ),
                                            )
                                          : Container(
                                              color: rose.withValues(alpha: 0.12),
                                              child: const Icon(
                                                Icons.person,
                                                color: rose,
                                              ),
                                            ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          d.fullName,
                                          style: TextStyle(
                                            fontWeight: sel
                                                ? FontWeight.w700
                                                : FontWeight.w600,
                                            fontSize: 15,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          d.specialization,
                                          style: const TextStyle(
                                              fontSize: 12, color: Colors.grey),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (sel)
                                    const Icon(Icons.check_circle_rounded,
                                        color: rose)
                                  else
                                    Icon(Icons.chevron_right_rounded,
                                        color: Colors.grey.shade400),
                                ],
                              ),
                            ),
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
}
