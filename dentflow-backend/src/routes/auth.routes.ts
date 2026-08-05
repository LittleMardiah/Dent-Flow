import { getErrorMessage } from "../utils/error.util";
import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { PatientRegisterSchema } from '../middleware/validation';
import { ZodError } from 'zod';
console.log("✅ AUTH ROUTES MODULE EXECUTED!");

const router = Router();

// =============== REGISTER ===============
router.post('/patient/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone } = PatientRegisterSchema.parse(req.body);
    const result = await authService.registerPatient(email, password, fullName, phone);
    res.status(201).json({
      success: true,
      data: {
        userId: result.userId,
        username: result.username,
        token: result.token,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validasi gagal',
        errors: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    const err = error as Error;
    res.status(400).json({
      success: false,
      message: err.message || 'Registrasi gagal',
    });
  }
});

// =============== PATIENT LOGIN ===============
router.post('/patient/login', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password wajib diisi',
      });
    }

    // If username provided, use it; otherwise use email as username
    const loginId = username || email;
    if (!loginId) {
      return res.status(400).json({
        success: false,
        message: 'Email atau username wajib diisi',
      });
    }

    const result = await authService.login(loginId, password, 'PATIENT');

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error: unknown) {
    res.status(401).json({
      success: false,
      message: getErrorMessage(error) || 'Login gagal',
    });
  }
});

// =============== ADMIN LOGIN ===============
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi',
      });
    }

    const result = await authService.login(username, password, 'ADMIN_BRANCH');

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error: unknown) {
    res.status(401).json({
      success: false,
      message: getErrorMessage(error) || 'Login gagal',
    });
  }
});

// =============== DOCTOR LOGIN ===============
router.post('/doctor/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi',
      });
    }

    const result = await authService.login(username, password, 'DOCTOR');

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error: unknown) {
    res.status(401).json({
      success: false,
      message: getErrorMessage(error) || 'Login gagal',
    });
  }
});

// =============== FORGOT PASSWORD ===============
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email wajib diisi',
      });
    }

    const result = await authService.forgotPassword(email);

    res.status(200).json({
      success: true,
      message: result.message,
      ...(process.env.NODE_ENV === 'development' && { devToken: result.devToken }),
    });
  } catch (error: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(error) || 'Terjadi kesalahan',
    });
  }
});

// =============== RESET PASSWORD ===============
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token dan password baru wajib diisi',
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka',
      });
    }

    const result = await authService.resetPassword(token, newPassword);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    res.status(400).json({
      success: false,
      message: getErrorMessage(error) || 'Reset password gagal',
    });
  }
});

console.log("🔍 ROUTER STACK:", router.stack.map(l => l.route?.path || "middleware"));

export default router;
