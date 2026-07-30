import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/booking_provider.dart';

class SelectBranchScreen extends StatelessWidget {
  const SelectBranchScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Pilih Cabang', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text('Pilih cabang klinik yang Anda kunjungi', style: TextStyle(fontSize: 14, color: Colors.grey)),
        const SizedBox(height: 16),
        if (p.isLoading) const Center(child: CircularProgressIndicator())
        else Expanded(
          child: ListView.builder(
            itemCount: p.branches.length,
            itemBuilder: (_, i) {
              final b = p.branches[i];
              final sel = p.selectedBranch?.id == b.id;
              return Card(
                elevation: sel ? 4 : 1,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: sel ? Colors.blue : Colors.transparent, width: 2)),
                child: ListTile(
                  title: Text(b.name, style: TextStyle(fontWeight: sel ? FontWeight.bold : FontWeight.normal)),
                  subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(b.address), Text(b.phone, style: const TextStyle(fontSize: 12))
                  ]),
                  trailing: sel ? const Icon(Icons.check_circle, color: Colors.blue) : null,
                  onTap: () { p.setBranch(b); p.nextStep(); },
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}
