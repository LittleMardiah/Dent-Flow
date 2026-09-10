import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Middleware helper: validasi req.body dengan schema zod.
// Error -> 400 { success:false, message, errors:[{field, message}] }
export const validateBody = (schema: z.ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validasi gagal',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.body = parsed.data;
    next();
  };
};

export const PatientRegisterSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
    .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
    .regex(/\d/, 'Password harus mengandung angka'),
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  phone: z.string().optional(),
});

export type PatientRegisterInput = z.infer<typeof PatientRegisterSchema>;

// Login schemas
export const LoginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
