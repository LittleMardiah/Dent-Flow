export enum QueueStatus {
  WAITING = 'WAITING',
  BEING_CALLED = 'BEING_CALLED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Queue {
  id: string;
  branchId: string;
  bookingId: string;
  doctorId: string;
  patientId: string;
  queueNumber: number;
  queueDate: Date;
  status: QueueStatus;
  checkInTime: Date;
  calledAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
