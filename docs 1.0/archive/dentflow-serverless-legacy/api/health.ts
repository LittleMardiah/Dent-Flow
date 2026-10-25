import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { success, error } from '../lib/response';

/**
 * GET /api/health
 * Health check endpoint — cek koneksi Supabase
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }

  try {
    // Test koneksi Supabase — query simple
    const { data, error: dbError } = await supabase
      .from('branches')
      .select('id, name')
      .limit(3);

    if (dbError) {
      return error(res, `Database error: ${dbError.message}`, 500, 'DB_ERROR');
    }

    return success(res, {
      status: 'ok',
      version: '1.0.1',
      runtime: 'vercel-serverless',
      region: process.env.VERCEL_REGION || 'unknown',
      services: {
        api: 'ok',
        database: 'ok',
      },
      branches: data?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return error(res, err.message || 'Internal error', 500, 'INTERNAL_ERROR');
  }
}