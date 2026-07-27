
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        branchId: string;
        role: 'PATIENT' | 'ADMIN_BRANCH' | 'DOCTOR';
        email?: string;
      };
      requestId?: string;
    }
  }
}

export {};
