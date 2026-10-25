import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant, AuthUser } from '../lib/auth';

// ============================================================
// Consolidated /api/inventory — Sub-Task C FASE B (Batch 5)
// - Approach B: vercel.json rewrites /api/inventory/:path* -> /api/inventory?path=$1
//   dan /inventory/:path* -> /api/inventory?path=$1 (no-prefix parity noShows D5).
// - Approach C: Express router di-mount prefix '/api/inventory' + '/inventory'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c).
// Scope: 7 endpoint (D9):
//   GET    /suppliers       (ADMIN_BRANCH)   bare string[] distinct
//   GET    /                (ADMIN_BRANCH+DOCTOR) bare array camelCase
//   POST   /                (ADMIN_BRANCH)   201 bare object
//   GET    /:id             (ADMIN_BRANCH+DOCTOR) bare object (UUID_RE)
//   PUT    /:id             (ADMIN_BRANCH)   bare object (UUID_RE)
//   PATCH  /:id/quantity    (ADMIN_BRANCH)   bare object (UUID_RE)
//   DELETE /:id             (ADMIN_BRANCH)   { success, data:{id}, message } (UUID_RE)
// Contract (source of truth): dentflow-web/src/lib/api/inventory.ts.
// Migration 044 applied (table inventory, RLS ON, anon revoked) — Sub-Task B.
// ============================================================

// Router-level guard = UNION (parity patients.ts). EMR autocomplete butuh
// DOCTOR (D3), semua write/computed di-restriksi ulang ke ADMIN_BRANCH.
const ALLOWED_ROLES = ['ADMIN_BRANCH', 'DOCTOR'];

// Response helpers — shape IDENTIK dengan lib/response (success/error).
const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message, timestamp: new Date().toISOString() });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (s: string): boolean => UUID_RE.test(s);

// Limiter untuk unique constraint idx_inventory_unique_active_item (D7).
const DUPLICATE_INDEX = 'idx_inventory_unique_active_item';

const router: Router = express.Router();

// ---------- Auth + env guard (level router, parity patients.ts) ----------
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const user = verifyJwt(token);
    requireRole(user, ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }
});

// GET-only guard (parity: metode selain GET => 405 METHOD_NOT_ALLOWED).
const getOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'GET') {
      return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req as AuthedRequest, res);
  };

// Admin-only guard (D3: suppliers + semua write = ADMIN_BRANCH only).
const adminOnly = (user: AuthUser, res: Response): boolean => {
  if (user.role !== 'ADMIN_BRANCH') {
    fail(res, 'Forbidden', 403, 'FORBIDDEN');
    return false;
  }
  return true;
};

// ---------- Branch scope resolver (D4) ----------
// branchId = body.branchId ?? query.branchId ?? user.branchId.
// Kalau branchId != user.branchId -> enforceTenant (grant check) -> 403 tanpa grant.
// Semua query inventory wajib .eq('branch_id', finalBranchId) + .is('deleted_at', null).
const resolveBranch = async (
  supabase: ReturnType<typeof getSupabase>,
  user: AuthUser,
  bodyBranch: unknown,
  queryBranch: unknown
): Promise<string> => {
  const bodyVal = typeof bodyBranch === 'string' && bodyBranch.length > 0 ? bodyBranch : undefined;
  const queryVal = typeof queryBranch === 'string' && queryBranch.length > 0 ? queryBranch : undefined;
  return enforceTenant(supabase, user, bodyVal ?? queryVal);
};

// ---------- Row mapper camelCase (D2) ----------
// isLowStock TIDAK di-response (computed client-side, parity contract).
// supplier/supplierContact -> '' kalau null.
const mapInventoryItem = (row: any) => ({
  id: row.id,
  itemName: row.item_name,
  category: row.category,
  quantity: Number(row.quantity_in_stock),
  unit: row.unit,
  unitCost: Number(row.unit_cost),
  minLevel: Number(row.reorder_level),
  supplier: row.supplier || '',
  supplierContact: row.supplier_contact || '',
  branchId: row.branch_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------- Audit helper (D10, non-blocking, pola queue.ts:231-239) ----------
const auditInsert = async (supabase: ReturnType<typeof getSupabase>, payload: Record<string, unknown>): Promise<void> => {
  try {
    await supabase.from('audit_logs').insert(payload);
  } catch {
    // Non-blocking: jangan gagalkan operasi utama kalau audit error.
  }
};

// ---------- GET /api/inventory/suppliers (LITERAL, wajib sebelum /:id) ----------
router.all('/suppliers', getOnly(async (req, res) => {
  const user = req.user;
  if (!adminOnly(user, res)) return;

  try {
    const supabase = getSupabase();
    let branchId: string;
    try {
      branchId = await resolveBranch(supabase, user, req.body && (req.body as any).branchId, req.query.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const { data, error: dbErr } = await supabase
      .from('inventory')
      .select('supplier')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .not('supplier', 'is', null);
    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const suppliers = [
      ...new Set(
        (data || [])
          .map((r: any) => (r.supplier ? String(r.supplier).trim() : ''))
          .filter((s: string) => s.length > 0)
      ),
    ];

    return ok(res, suppliers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- POST /api/inventory (create, ADMIN_BRANCH) ----------
// WAJIB sebelum router.all('/', getOnly) — kalau kebalik, getOnly shadow POST -> 405.
router.post('/', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!adminOnly(user, res)) return;

  const body = (req.body || {}) as {
    itemName?: unknown;
    category?: unknown;
    quantity?: unknown;
    unit?: unknown;
    unitCost?: unknown;
    minLevel?: unknown;
    supplier?: unknown;
    supplierContact?: unknown;
    branchId?: unknown;
  };

  if (typeof body.itemName !== 'string' || !body.itemName.trim()) {
    return fail(res, 'itemName wajib diisi', 400, 'VALIDATION_ERROR');
  }
  if (typeof body.category !== 'string' || !body.category.trim()) {
    return fail(res, 'category wajib diisi', 400, 'VALIDATION_ERROR');
  }

  const quantity = body.quantity === undefined ? 0 : Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return fail(res, 'quantity harus integer >= 0', 400, 'VALIDATION_ERROR');
  }
  const unit = typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : 'pcs';
  const unitCost = body.unitCost === undefined ? 0 : Number(body.unitCost);
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return fail(res, 'unitCost harus angka >= 0', 400, 'VALIDATION_ERROR');
  }
  const minLevel = body.minLevel === undefined ? 0 : Number(body.minLevel);
  if (!Number.isInteger(minLevel) || minLevel < 0) {
    return fail(res, 'minLevel harus integer >= 0', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();
    let finalBranchId: string;
    try {
      finalBranchId = await resolveBranch(supabase, user, body.branchId, req.query.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const insertPayload: Record<string, unknown> = {
      branch_id: finalBranchId,
      item_name: body.itemName.trim(),
      category: body.category.trim(),
      quantity_in_stock: quantity,
      unit,
      unit_cost: unitCost,
      reorder_level: minLevel,
      supplier: typeof body.supplier === 'string' && body.supplier.trim() ? body.supplier.trim() : null,
      supplier_contact: typeof body.supplierContact === 'string' && body.supplierContact.trim() ? body.supplierContact.trim() : null,
    };

    const { data: row, error: insErr } = await supabase
      .from('inventory')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insErr && insErr.code === '23505') {
      // D7: extract index name, verifikasi idx_inventory_unique_active_item.
      const msg = `${insErr.message || ''} ${insErr.details || ''}`;
      const match = msg.match(/unique constraint "([^"]+)"/);
      const constraint = match ? match[1] : 'unknown';
      return fail(res, 'Item dengan nama yang sama sudah ada di cabang ini', 409, 'DUPLICATE_ITEM');
    }
    if (insErr || !row) return fail(res, `Database error: ${insErr?.message || 'insert returned empty'}`, 500, 'DB_ERROR');

    await auditInsert(supabase, {
      branch_id: row.branch_id,
      user_id: user.userId,
      event_type: 'INVENTORY_CREATE',
      entity_type: 'INVENTORY',
      entity_id: row.id,
      description: `Item inventory '${row.item_name}' dibuat`,
      new_values: {
        item_name: row.item_name,
        category: row.category,
        quantity_in_stock: Number(row.quantity_in_stock),
        unit: row.unit,
        unit_cost: Number(row.unit_cost),
        reorder_level: Number(row.reorder_level),
      },
    });

    return ok(res, mapInventoryItem(row), 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- GET /api/inventory (list, ADMIN_BRANCH + DOCTOR) ----------
router.all('/', getOnly(async (req, res) => {
  const user = req.user;
  try {
    const supabase = getSupabase();
    let branchId: string;
    try {
      branchId = await resolveBranch(supabase, user, req.body && (req.body as any).branchId, req.query.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const { data, error: dbErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('item_name', { ascending: true });
    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    return ok(res, (data || []).map((r: any) => mapInventoryItem(r)));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- PUT /api/inventory/:id (update, ADMIN_BRANCH) ----------
// WRITE: sebelum router.all('/:id', getOnly) supaya tidak shadow (task 2.4.2c P1/P2).
router.put('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!adminOnly(user, res)) return;

  const itemId = req.params.id;
  if (!itemId || !isValidUuid(itemId)) {
    return fail(res, 'Parameter id item harus uuid valid', 400, 'VALIDATION_ERROR');
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  let hasField = false;

  if (body.itemName !== undefined) {
    if (typeof body.itemName !== 'string' || !(body.itemName as string).trim()) {
      return fail(res, 'itemName wajib string non-kosong', 400, 'VALIDATION_ERROR');
    }
    updates.item_name = (body.itemName as string).trim();
    hasField = true;
  }
  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || !(body.category as string).trim()) {
      return fail(res, 'category wajib string non-kosong', 400, 'VALIDATION_ERROR');
    }
    updates.category = (body.category as string).trim();
    hasField = true;
  }
  if (body.quantity !== undefined) {
    const q = Number(body.quantity);
    if (!Number.isInteger(q) || q < 0) {
      return fail(res, 'quantity harus integer >= 0', 400, 'VALIDATION_ERROR');
    }
    updates.quantity_in_stock = q;
    hasField = true;
  }
  if (body.unit !== undefined) {
    if (typeof body.unit !== 'string' || !(body.unit as string).trim()) {
      return fail(res, 'unit wajib string non-kosong', 400, 'VALIDATION_ERROR');
    }
    updates.unit = (body.unit as string).trim();
    hasField = true;
  }
  if (body.unitCost !== undefined) {
    const c = Number(body.unitCost);
    if (!Number.isFinite(c) || c < 0) {
      return fail(res, 'unitCost harus angka >= 0', 400, 'VALIDATION_ERROR');
    }
    updates.unit_cost = c;
    hasField = true;
  }
  if (body.minLevel !== undefined) {
    const m = Number(body.minLevel);
    if (!Number.isInteger(m) || m < 0) {
      return fail(res, 'minLevel harus integer >= 0', 400, 'VALIDATION_ERROR');
    }
    updates.reorder_level = m;
    hasField = true;
  }
  if (body.supplier !== undefined) {
    if (typeof body.supplier !== 'string') {
      return fail(res, 'supplier wajib string', 400, 'VALIDATION_ERROR');
    }
    updates.supplier = (body.supplier as string).trim() || null;
    hasField = true;
  }
  if (body.supplierContact !== undefined) {
    if (typeof body.supplierContact !== 'string') {
      return fail(res, 'supplierContact wajib string', 400, 'VALIDATION_ERROR');
    }
    updates.supplier_contact = (body.supplierContact as string).trim() || null;
    hasField = true;
  }

  if (!hasField) return fail(res, 'Minimal satu field wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();
    let branchId: string;
    try {
      branchId = await resolveBranch(supabase, user, body.branchId, req.query.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Pre-fetch existing row (branch scope + soft-delete) untuk old_values audit
    // + 404 parity patients PUT.
    const { data: before, error: bErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', itemId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (bErr) return fail(res, `Database error: ${bErr.message}`, 500, 'DB_ERROR');
    if (!before) return fail(res, 'Item tidak ditemukan', 404, 'ITEM_NOT_FOUND');

    updates.updated_at = new Date().toISOString();
    const { data: row, error: upErr } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', itemId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    if (upErr && upErr.code === '23505') {
      const msg = `${upErr.message || ''} ${upErr.details || ''}`;
      const match = msg.match(/unique constraint "([^"]+)"/);
      const constraint = match ? match[1] : 'unknown';
      return fail(res, 'Item dengan nama yang sama sudah ada di cabang ini', 409, 'DUPLICATE_ITEM');
    }
    if (upErr) return fail(res, `Database error: ${upErr.message}`, 500, 'DB_ERROR');
    if (!row) return fail(res, 'Item tidak ditemukan', 404, 'ITEM_NOT_FOUND');

    await auditInsert(supabase, {
      branch_id: row.branch_id,
      user_id: user.userId,
      event_type: 'INVENTORY_UPDATE',
      entity_type: 'INVENTORY',
      entity_id: row.id,
      description: `Item inventory '${row.item_name}' diperbarui`,
      old_values: {
        item_name: before.item_name,
        category: before.category,
        quantity_in_stock: Number(before.quantity_in_stock),
        unit: before.unit,
        unit_cost: Number(before.unit_cost),
        reorder_level: Number(before.reorder_level),
      },
      new_values: {
        item_name: row.item_name,
        category: row.category,
        quantity_in_stock: Number(row.quantity_in_stock),
        unit: row.unit,
        unit_cost: Number(row.unit_cost),
        reorder_level: Number(row.reorder_level),
      },
    });

    return ok(res, mapInventoryItem(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- PATCH /api/inventory/:id/quantity (adjust, ADMIN_BRANCH, race-safe) ----------
// D8. Body { type: 'add'|'subtract', quantity (>0 integer), notes? }.
// Race-safe: CAS (compare-and-swap) — update difilter `quantity_in_stock = <nilai
// yang baru dibaca>` supaya dua adjust konkuren tidak saling menimpa. SQL
// `SET quantity_in_stock = quantity_in_stock + q` TIDAK didukung PostgREST
// (terbukti 22P02) dan RPC baru tidak boleh (no migration). CAS + retry mencapai
// atomicity yang sama (linearizable). Deviation dicatat di laporan Fase B.
router.patch('/:id/quantity', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!adminOnly(user, res)) return;

  const itemId = req.params.id;
  if (!itemId || !isValidUuid(itemId)) {
    return fail(res, 'Parameter id item harus uuid valid', 400, 'VALIDATION_ERROR');
  }

  const body = (req.body || {}) as { type?: unknown; quantity?: unknown; notes?: unknown; branchId?: unknown };
  const type = String(body.type || '');
  if (type !== 'add' && type !== 'subtract') {
    return fail(res, "type wajib 'add' atau 'subtract'", 400, 'VALIDATION_ERROR');
  }
  const qty = Number(body.quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return fail(res, 'quantity harus integer > 0', 400, 'VALIDATION_ERROR');
  }
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : '';

  try {
    const supabase = getSupabase();
    let branchId: string;
    try {
      branchId = await resolveBranch(supabase, user, body.branchId, req.query.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Retry bounded (kasus normal: attempt 0 langsung sukses).
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data: item, error: readErr } = await supabase
        .from('inventory')
        .select('id, item_name, quantity_in_stock')
        .eq('id', itemId)
        .eq('branch_id', branchId)
        .is('deleted_at', null)
        .maybeSingle();
      if (readErr) return fail(res, `Database error: ${readErr.message}`, 500, 'DB_ERROR');
      if (!item) return fail(res, 'Item tidak ditemukan', 404, 'ITEM_NOT_FOUND');

      const current = Number(item.quantity_in_stock);
      if (type === 'subtract' && current < qty) {
        return fail(res, `Stok tidak mencukupi: tersedia ${current}`, 409, 'INSUFFICIENT_STOCK');
      }
      const next = type === 'add' ? current + qty : current - qty;

      const { data: row, error: upErr } = await supabase
        .from('inventory')
        .update({ quantity_in_stock: next, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('branch_id', branchId)
        .is('deleted_at', null)
        .eq('quantity_in_stock', current)
        .select('*')
        .maybeSingle();

      if (upErr) return fail(res, `Database error: ${upErr.message}`, 500, 'DB_ERROR');
      if (row) {
        const prevQty = type === 'add' ? current : current + qty;
        await auditInsert(supabase, {
          branch_id: row.branch_id,
          user_id: user.userId,
          event_type: 'INVENTORY_ADJUST',
          entity_type: 'INVENTORY',
          entity_id: row.id,
          description: `Stok item '${row.item_name}' ${type === 'add' ? 'ditambah' : 'dikurangi'} ${qty}${notes ? ` (${notes})` : ''}`,
          old_values: { quantity: prevQty },
          new_values: { quantity: Number(row.quantity_in_stock) },
        });
        return ok(res, mapInventoryItem(row));
      }
      // CAS conflict (nilai berubah) → retry dengan baca ulang.
    }

    return fail(res, 'Konflik update stok, coba lagi', 500, 'INTERNAL_ERROR');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- DELETE /api/inventory/:id (soft delete, ADMIN_BRANCH) ----------
// Parity patients.ts P2 (response shape). WRITE: sebelum getOnly('/:id').
router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!adminOnly(user, res)) return;

  const itemId = req.params.id;
  if (!itemId || !isValidUuid(itemId)) {
    return fail(res, 'Parameter id item harus uuid valid', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();
    let branchId: string;
    try {
      branchId = await resolveBranch(supabase, user, req.body && (req.body as any).branchId, req.query.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const now = new Date().toISOString();
    const { data: deleted, error: dErr } = await supabase
      .from('inventory')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', itemId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (dErr) return fail(res, `Database error: ${dErr.message}`, 500, 'DB_ERROR');
    if (!deleted) return fail(res, 'Item tidak ditemukan', 404, 'ITEM_NOT_FOUND');

    await auditInsert(supabase, {
      branch_id: deleted.branch_id,
      user_id: user.userId,
      event_type: 'INVENTORY_DELETE',
      entity_type: 'INVENTORY',
      entity_id: deleted.id,
      description: `Item inventory '${deleted.item_name}' dihapus (soft delete)`,
    });

    return res.status(200).json({
      success: true,
      data: { id: itemId },
      message: 'Item inventory berhasil dihapus',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- GET /api/inventory/:id (detail, ADMIN_BRANCH + DOCTOR) ----------
// PARAM — paling terakhir supaya tidak shadow route literal/nested/write.
router.all('/:id', getOnly(async (req, res) => {
  const user = req.user;
  const itemId = req.params.id;
  if (!itemId || !isValidUuid(itemId)) {
    return fail(res, 'Parameter id item harus uuid valid', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();
    let branchId: string;
    try {
      branchId = await resolveBranch(supabase, user, req.body && (req.body as any).branchId, req.query.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Cross-branch / soft-deleted / not found -> 404 ITEM_NOT_FOUND (no info leak, D4).
    const { data: row, error: dbErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', itemId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');
    if (!row) return fail(res, 'Item tidak ditemukan', 404, 'ITEM_NOT_FOUND');

    return ok(res, mapInventoryItem(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain inventory ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain inventory.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/inventory' + '/inventory'
// (D5 multi-mount parity noShows). 1 router, 1 reconstruct branch.
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/inventory', router);
app.use('/inventory', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix match semua sub-path. Safeguard: kalau runtime strip URL jadi
  // destination saja (/api/inventory) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/inventory/${suffix}`;
    }
  }
  return app(r, res as any);
}