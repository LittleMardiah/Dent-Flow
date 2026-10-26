import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/booking_provider.dart';

class SelectBranchScreen extends StatelessWidget {
  const SelectBranchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    const rose = Color(0xFFD08080);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Pilih Cabang',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Pilih cabang klinik yang Anda kunjungi',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 16),
          if (p.isLoading)
            const Center(child: CircularProgressIndicator())
          else
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 1,
                  mainAxisExtent: 110,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: p.branches.length,
                itemBuilder: (_, i) {
                  final b = p.branches[i];
                  final sel = p.selectedBranch?.id == b.id;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeInOut,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: sel
                          ? [
                              BoxShadow(
                                color: rose.withValues(alpha: 0.25),
                                blurRadius: 12,
                                spreadRadius: 1,
                                offset: const Offset(0, 4),
                              )
                            ]
                          : [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
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
                          width: sel ? 2.5 : 1,
                        ),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () {
                          p.setBranch(b);
                          p.nextStep();
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Hero(
                                tag: 'branch_icon_${b.id}',
                                child: Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: LinearGradient(
                                      colors: sel
                                          ? [rose.withValues(alpha: 0.9), rose]
                                          : [Colors.grey.shade100, Colors.grey.shade200],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                  ),
                                  child: Icon(
                                    Icons.local_hospital_rounded,
                                    color: sel ? Colors.white : Colors.grey.shade700,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Hero(
                                      tag: 'branch_name_${b.id}',
                                      child: Material(
                                        color: Colors.transparent,
                                        child: Text(
                                          b.name,
                                          style: TextStyle(
                                            fontWeight: sel ? FontWeight.w700 : FontWeight.w600,
                                            fontSize: 16,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      b.address,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    Text(
                                      b.phone,
                                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                                    ),
                                  ],
                                ),
                              ),
                              if (sel)
                                const Icon(Icons.check_circle_rounded, color: rose)
                              else
                                Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400),
                            ],
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
