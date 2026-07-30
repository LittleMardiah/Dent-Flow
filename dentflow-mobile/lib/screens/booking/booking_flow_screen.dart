import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/booking_provider.dart';
import 'select_branch_screen.dart';
import 'select_doctor_screen.dart';
import 'select_time_screen.dart';
import 'review_screen.dart';
import 'payment_screen.dart';
import 'confirmation_screen.dart';

class BookingFlowScreen extends StatefulWidget {
  const BookingFlowScreen({super.key});
  @override
  State<BookingFlowScreen> createState() => _BookingFlowScreenState();
}
class _BookingFlowScreenState extends State<BookingFlowScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) =>
      Provider.of<BookingProvider>(context, listen: false).loadBranches());
  }
  @override
  Widget build(BuildContext context) {
    final p = Provider.of<BookingProvider>(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(p.stepTitle),
        leading: p.hasPrevStep ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: p.prevStep) : null,
      ),
      body: Column(children: [
        Padding(padding: const EdgeInsets.all(16),
          child: Row(children: List.generate(6, (i) {
            final active = i <= p.currentStep;
            return Expanded(child: Row(children: [
              Container(width: 30, height: 30, decoration: BoxDecoration(shape: BoxShape.circle,
                color: active ? Colors.blue : Colors.grey.shade300),
                child: Center(child: Text('${i+1}', style: TextStyle(color: active ? Colors.white : Colors.grey.shade600, fontWeight: FontWeight.bold, fontSize: 12)))),
              if (i < 5) Expanded(child: Container(height: 2, color: active ? Colors.blue : Colors.grey.shade300)),
            ]));
          })),
        ),
        Expanded(child: IndexedStack(index: p.currentStep, children: const [
          SelectBranchScreen(), SelectDoctorScreen(), SelectTimeScreen(),
          ReviewScreen(), PaymentScreen(), ConfirmationScreen(),
        ])),
      ]),
    );
  }
}
