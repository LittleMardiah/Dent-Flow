import 'package:flutter/material.dart';
import 'booking/booking_flow_screen.dart';

class BookingsScreen extends StatelessWidget {
  const BookingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bookings'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BookingFlowScreen()))),
      ]),
      body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.bookmark_border, size: 64, color: Colors.grey),
        const SizedBox(height: 16),
        const Text('Belum ada booking', style: TextStyle(fontSize: 16, color: Colors.grey)),
        const SizedBox(height: 8),
        TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BookingFlowScreen())), child: const Text('Booking Sekarang')),
      ])),
    );
  }
}
