import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryRose = Color(0xFFD08080);
  static const Color primary = primaryRose; // Alias
  static const Color secondaryRose = Color(0xFF8F4A4B);
  static const Color secondary = secondaryRose; // Alias
  static const Color backgroundWhite = Color(0xFFFFF8F7);
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color successGreen = Color(0xFF4CAF50);
  static const Color accentBlue = Color(0xFF2E86C1);

  static ThemeData get lightTheme {
    return ThemeData(
      primaryColor: primaryRose,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryRose,
        primary: primaryRose,
        secondary: secondaryRose,
        surface: backgroundWhite,
      ),
      scaffoldBackgroundColor: backgroundWhite,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(),
      useMaterial3: true,
    );
  }
}
