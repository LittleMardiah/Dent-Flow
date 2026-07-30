import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:provider/provider.dart';
import '../../providers/booking_provider.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});
  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}
class _PaymentScreenState extends State<PaymentScreen> {
  late WebViewController _ctrl;
  bool _loading = true;
  @override
  void initState() {
    super.initState();
    final url = Provider.of<BookingProvider>(context, listen: false).paymentUrl;
    if (url == null) { WidgetsBinding.instance.addPostFrameCallback((_) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('URL pembayaran tidak ditemukan'))); Navigator.pop(context); }); return; }
    _ctrl = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (u) { setState(() => _loading = true); if (u.contains('payment-success') || u.contains('booking-confirmation')) { _onSuccess(); } },
        onPageFinished: (u) => setState(() => _loading = false),
        onWebResourceError: (e) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.description}'))),
      ))
      ..loadRequest(Uri.parse(url));
  }
  void _onSuccess() { WidgetsBinding.instance.addPostFrameCallback((_) => Provider.of<BookingProvider>(context, listen: false).nextStep()); }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pembayaran DP'), leading: IconButton(
        icon: const Icon(Icons.close),
        onPressed: () => showDialog(context: context, builder: (ctx) => AlertDialog(
          title: const Text('Batalkan Pembayaran?'),
          content: const Text('Booking akan dibatalkan jika keluar.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Kembali')),
            TextButton(onPressed: () { Navigator.pop(ctx); Navigator.pop(context); }, child: const Text('Keluar')),
          ],
        )),
      )),
      body: Stack(children: [
        WebViewWidget(controller: _ctrl),
        if (_loading) const Center(child: CircularProgressIndicator()),
      ]),
    );
  }
}
