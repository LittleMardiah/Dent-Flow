import 'package:flutter/material.dart';
import '../screens/walkin/walkin_form_screen.dart';

class HomeQuickActions extends StatelessWidget {
  const HomeQuickActions({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8.0),
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                // Navigasi ke booking flow (sudah ada)
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Booking coming soon')),
                );
              },
              icon: const Icon(Icons.add),
              label: const Text('Booking Sekarang'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const WalkInFormScreen(),
                  ),
                );
              },
              icon: const Icon(Icons.person_add),
              label: const Text('Walk-in'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                foregroundColor: Colors.blue,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
