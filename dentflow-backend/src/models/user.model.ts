// Definisi tipe data User (sesuai TDD Section 4)
export interface IUser {
  id: string;
  branch_id: string;
  email: string;
  phone_number?: string;
  full_name: string;
  password_hash: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  doctor_specialization?: string; // Hanya untuk DOCTOR
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

// Untuk response API (tanpa password_hash)
export type UserResponse = Omit<IUser, 'password_hash'>;
