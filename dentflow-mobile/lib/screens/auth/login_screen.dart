import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_button.dart';
import 'register_screen.dart';
import 'forgot_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  String? _selectedKategori;
  static final List<String> _kategoriOptions = [
    'Klinik Umum',
    'Klinik Spesialis Gigi',
    'Orthodontics',
    'Periodontics',
    'Oral Surgery',
  ];

  void _handleLogin() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      setState(() => _errorMessage = 'Silakan masukkan email dan password');
      _showToast('Silakan masukkan email dan password');
      return;
    }
    setState(() => _isLoading = true);
    // TODO: Implement AuthProvider login
    await Future.delayed(const Duration(seconds: 2));
    setState(() => _isLoading = false);
  }

  void _showToast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.primaryRose,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundWhite,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              const Icon(Icons.medical_services, size: 80, color: AppTheme.primaryRose),
              const SizedBox(height: 24),
              // Kategori Pill Badge
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8.0),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppTheme.primaryRose.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppTheme.primaryRose.withOpacity(0.5)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
                    child: _selectedKategori != null
                        ? Text(
                            _selectedKategori!,
                            style: TextStyle(
                              color: AppTheme.primaryRose,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          )
                        : Wrap(
                            spacing: 4.0,
                            children: _kategoriOptions.map((kategori) {
                              final isSelected = _selectedKategori == kategori;
                              return ChoiceChip(
                                label: Text(kategori),
                                selected: isSelected,
                                selectedColor: AppTheme.primaryRose,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                onSelected: (selected) {
                                  setState(() {
                                    _selectedKategori = selected ? kategori : null;
                                  });
                                },
                                backgroundColor: Colors.white,
                                labelPadding: EdgeInsets.zero,
                                labelStyle: TextStyle(
                                  color: isSelected ? AppTheme.primaryRose : AppTheme.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              );
                            }).toList(),
                          ),
                  ),
                ),
              ),
              Text(
                'Selamat Datang',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Masuk ke akun DentFlow Anda',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 40),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Email',
                  prefixIcon: const Icon(Icons.email, color: AppTheme.primaryRose),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppTheme.primaryRose, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock, color: AppTheme.primaryRose),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppTheme.primaryRose, width: 2),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()));
                  },
                  child: const Text('Lupa Password?', style: TextStyle(color: AppTheme.secondaryRose)),
                ),
              ),
              const SizedBox(height: 24),
              PremiumButton(
                text: 'Login',
                isLoading: _isLoading,
                onPressed: _handleLogin,
              ),
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
                  },
                  child: const Text(
                    'Belum punya akun? Daftar sekarang',
                    style: TextStyle(color: AppTheme.primaryRose, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
