import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_button.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({Key? key}) : super(key: key);

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  bool _isLoading = false;

  void _handleReset() async {
    if (_emailController.text.isEmpty) return;
    setState(() => _isLoading = true);
    // TODO: Panggil API /auth/forgot-password
    await Future.delayed(const Duration(seconds: 2));
    setState(() => _isLoading = false);
    
    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Email Terkirim'),
          content: const Text('Link reset password telah dikirim ke email Anda. Silakan cek kotak masuk.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
              child: const Text('Kembali ke Login', style: TextStyle(color: AppTheme.primaryRose)),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundWhite,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppTheme.primaryRose),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.lock_reset, size: 64, color: AppTheme.primaryRose),
              const SizedBox(height: 24),
              Text(
                'Lupa Password?',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Masukkan email yang terdaftar. Kami akan mengirimkan link untuk mereset password Anda.',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 16),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Email',
                  hintText: 'contoh@email.com',
                  prefixIcon: const Icon(Icons.email_outlined, color: AppTheme.primaryRose),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppTheme.primaryRose, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: PremiumButton(
                  text: 'Kirim Link Reset',
                  isLoading: _isLoading,
                  onPressed: _handleReset,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
