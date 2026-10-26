import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'main_screen.dart';
import 'auth/login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  double _progress = 0.0;
  int _stageIndex = 0;
  late String _statusText;
  late List<String> _stages;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _stages = [
      'Memuat data klinik...',
      'Sinkronisasi profil pasien...',
      'Siap digunakan',
    ];
    _statusText = _stages[0];
    _startProgressTimer();
    _navigateAfterDelay();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startProgressTimer() {
    _timer = Timer.periodic(const Duration(milliseconds: 300), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _progress = _progress + 0.1 > 1.0 ? 1.0 : _progress + 0.1;
        if (_progress >= 0.5 && _stageIndex < 1) {
          _stageIndex = 1;
          _statusText = _stages[1];
        }
        if (_progress >= 1.0 && _stageIndex < 2) {
          _stageIndex = 2;
          _statusText = _stages[2];
        }
      });
      if (_progress >= 1.0) {
        timer.cancel();
      }
    });
  }

  Future<void> _navigateAfterDelay() async {
    await Future.delayed(const Duration(seconds: 3));
    if (!mounted) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final isLoggedIn = authProvider.isLoggedIn;
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => isLoggedIn ? const MainScreen() : const LoginScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.health_and_safety,
                size: 80,
                color: Color(0xFFD08080),
              ),
              const SizedBox(height: 16),
              const Text(
                'DentFlow Mobile',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFD08080),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Patient Portal',
                style: TextStyle(fontSize: 16, color: Color(0xFF666666)),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: 200,
                child: LinearProgressIndicator(
                  value: _progress,
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(12),
                  color: const Color(0xFFD08080),
                  backgroundColor: const Color(0xFFFFF0F0),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _statusText,
                style: const TextStyle(fontSize: 12, color: Color(0xFF666666)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
