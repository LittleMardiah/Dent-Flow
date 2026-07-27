export interface TemporaryPatient {
  id: string;
  branchId: string;
  fullName: string;
  phone: string;
  age?: number;
  convertedToPatientId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateTemporaryPatientInput {
  fullName: string;
  phone: string;
  age?: number;
  branchId: string;
}
