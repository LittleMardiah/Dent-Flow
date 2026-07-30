import 'package:flutter/material.dart';
import '../models/prescription_model.dart';

class HealthReminderCard extends StatelessWidget {
  final List<Prescription> prescriptions;

  const HealthReminderCard({super.key, required this.prescriptions});

  @override
  Widget build(BuildContext context) {
    if (prescriptions.isEmpty) {
      return const SizedBox.shrink();
    }

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.medication, size: 20, color: Colors.green),
                SizedBox(width: 8),
                Text(
                  '💊 Pengingat Kesehatan',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...prescriptions.take(3).map((prescription) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  children: [
                    const Icon(Icons.circle, size: 8, color: Colors.green),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${prescription.medicationName} - ${prescription.dosage} (${prescription.frequency})',
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
