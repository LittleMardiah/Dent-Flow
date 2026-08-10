/**
 * Encounter Status Enum
 * Status dari sesi pemeriksaan pasien oleh dokter
 */
export enum EncounterStatus {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Type untuk status encounter (berdasarkan enum)
 */
export type EncounterStatusType = `${EncounterStatus}`;
