import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from './auth';

const BUCKET = 'dentflow';
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const UPLOAD_EXPIRY_SEC = 300; // 5 min
const DOWNLOAD_EXPIRY_SEC = 3600; // 1 hour

export class StorageError extends Error {
  constructor(public code: string, message: string, public statusCode = 400) {
    super(message);
  }
}

/**
 * Issue upload ticket (signed URL) + insert metadata row.
 * Only DOCTOR/ADMIN_BRANCH can issue. Ownership: encounter belongs to
 * user's branch.
 */
export async function issueUploadTicket(
  supabase: SupabaseClient,
  user: AuthUser,
  encounterId: string,
  meta: { filename: string; size: number; mime: string }
): Promise<{ docId: string; path: string; signedUrl: string; token: string }> {
  // 1. Validate meta
  if (!meta.filename || typeof meta.filename !== 'string') {
    throw new StorageError('VALIDATION_ERROR', 'filename wajib');
  }
  if (!Number.isFinite(meta.size) || meta.size <= 0) {
    throw new StorageError('VALIDATION_ERROR', 'size wajib >0');
  }
  if (meta.size > MAX_SIZE_BYTES) {
    throw new StorageError('FILE_TOO_LARGE', `Max ${MAX_SIZE_BYTES} bytes`);
  }
  if (!ALLOWED_MIME.includes(meta.mime)) {
    throw new StorageError('INVALID_MIME', `MIME not allowed: ${meta.mime}`);
  }

  // 2. Verify encounter exists + user branch scope
  const { data: enc, error: encErr } = await supabase
    .from('encounters')
    .select('id, branch_id, patient_id')
    .eq('id', encounterId)
    .eq('branch_id', user.branchId)
    .maybeSingle();
  if (encErr) throw new StorageError('DB_ERROR', encErr.message, 500);
  if (!enc) throw new StorageError('ENCOUNTER_NOT_FOUND', 'Encounter tidak ditemukan', 404);

  // 3. Generate path
  const ext = meta.filename.split('.').pop()?.toLowerCase() || 'bin';
  const docId = crypto.randomUUID();
  const path = `emr/${encounterId}/${docId}.${ext}`;

  // 4. Create signed upload URL (upsert=false)
  const { data: signed, error: signErr } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (signErr || !signed) {
    throw new StorageError('SIGNED_URL_ERROR', signErr?.message || 'Gagal create signed URL', 500);
  }

  // 5. Insert metadata (row BEFORE upload = reservation)
  const { data: inserted, error: insErr } = await supabase
    .from('encounter_documents')
    .insert({
      id: docId,
      encounter_id: encounterId,
      patient_id: enc.patient_id,
      bucket: BUCKET,
      path,
      original_name: meta.filename,
      mime: meta.mime,
      size_bytes: meta.size,
      uploaded_by: user.userId,
    })
    .select('id, path')
    .single();
  if (insErr) throw new StorageError('DB_ERROR', insErr.message, 500);

  return {
    docId: inserted.id,
    path: inserted.path,
    signedUrl: signed.signedUrl,
    token: signed.token,
  };
}

/**
 * List documents for an encounter + signed download URLs.
 */
export async function listDocuments(
  supabase: SupabaseClient,
  user: AuthUser,
  encounterId: string
): Promise<
  Array<{
    id: string;
    originalName: string;
    mime: string;
    sizeBytes: number;
    createdAt: string;
    signedUrl: string | null;
  }>
> {
  // Verify encounter branch scope
  const { data: enc, error: encErr } = await supabase
    .from('encounters')
    .select('id')
    .eq('id', encounterId)
    .eq('branch_id', user.branchId)
    .maybeSingle();
  if (encErr) throw new StorageError('DB_ERROR', encErr.message, 500);
  if (!enc) throw new StorageError('ENCOUNTER_NOT_FOUND', 'Encounter tidak ditemukan', 404);

  const { data: rows, error } = await supabase
    .from('encounter_documents')
    .select('id, path, original_name, mime, size_bytes, created_at')
    .eq('encounter_id', encounterId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new StorageError('DB_ERROR', error.message, 500);

  const results: Array<{
    id: string;
    originalName: string;
    mime: string;
    sizeBytes: number;
    createdAt: string;
    signedUrl: string | null;
  }> = [];
  for (const r of rows || []) {
    let signedUrl: string | null = null;
    const { data: dl } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUrl(r.path, DOWNLOAD_EXPIRY_SEC);
    if (dl?.signedUrl) signedUrl = dl.signedUrl;
    results.push({
      id: r.id,
      originalName: r.original_name,
      mime: r.mime,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
      signedUrl,
    });
  }
  return results;
}