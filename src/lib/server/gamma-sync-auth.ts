import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdmin } from '@/lib/supabase/admin';

const CONTROLLER_TOKEN_BYTES = 32;

export interface GammaControllerAccess {
  controllerId: string;
  deckId: string;
  sessionId: string;
}

export interface GammaLeaseState {
  granted: boolean;
  activeControllerId: string | null;
  leaseExpiresAt: string | null;
  remoteHoldUntil: string | null;
}

export function hashGammaSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function sanitizeControllerLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Chrome presenter';
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
  return clean || 'Chrome presenter';
}

function leaseFromRpc(row: Record<string, unknown> | null | undefined): GammaLeaseState {
  return {
    granted: row?.granted === true,
    activeControllerId:
      typeof row?.active_controller_id === 'string' ? row.active_controller_id : null,
    leaseExpiresAt: typeof row?.lease_expires_at === 'string' ? row.lease_expires_at : null,
    remoteHoldUntil: typeof row?.remote_hold_until === 'string' ? row.remote_hold_until : null,
  };
}

export async function claimGammaLease(
  sessionId: string,
  controllerId: string,
  force = false,
  admin: SupabaseClient = getAdmin(),
): Promise<GammaLeaseState> {
  const { data, error } = await admin.rpc('claim_gamma_controller_lease', {
    p_session_id: sessionId,
    p_controller_id: controllerId,
    p_force: force,
    p_ttl_seconds: 75,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return leaseFromRpc(row as Record<string, unknown> | null);
}

export async function releaseGammaLease(
  sessionId: string,
  controllerId: string,
  admin: SupabaseClient = getAdmin(),
) {
  const { error } = await admin.rpc('release_gamma_controller_lease', {
    p_session_id: sessionId,
    p_controller_id: controllerId,
  });
  if (error) throw new Error(error.message);
}

export async function holdGammaLeaseForRemote(
  sessionId: string,
  admin: SupabaseClient = getAdmin(),
): Promise<string | null> {
  const { data, error } = await admin.rpc('hold_gamma_controller_for_remote', {
    p_session_id: sessionId,
    p_hold_seconds: 30,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : null;
}

export async function issueGammaController(
  sessionId: string,
  label: unknown,
  admin: SupabaseClient = getAdmin(),
) {
  const token = randomBytes(CONTROLLER_TOKEN_BYTES).toString('base64url');
  const { data: controller, error } = await admin
    .from('gamma_controllers')
    .insert({
      session_id: sessionId,
      token_hash: hashGammaSecret(token),
      label: sanitizeControllerLabel(label),
    })
    .select('id')
    .single();
  if (error || !controller) throw new Error(error?.message ?? 'controller_create_failed');
  const lease = await claimGammaLease(sessionId, controller.id, false, admin);
  return { controllerId: controller.id as string, controllerToken: token, lease };
}

export async function verifyGammaController(
  sessionId: string,
  token: string | null,
  admin: SupabaseClient = getAdmin(),
): Promise<GammaControllerAccess | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const { data: controller } = await admin
    .from('gamma_controllers')
    .select('id, session_id')
    .eq('session_id', sessionId)
    .eq('token_hash', hashGammaSecret(token))
    .is('revoked_at', null)
    .single();
  if (!controller) return null;
  const { data: session } = await admin
    .from('sessions')
    .select('deck_id')
    .eq('id', sessionId)
    .single();
  if (!session) return null;
  await admin
    .from('gamma_controllers')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', controller.id);
  return {
    controllerId: controller.id as string,
    deckId: session.deck_id as string,
    sessionId,
  };
}

export async function gammaLeaseIsActive(
  sessionId: string,
  controllerId: string,
  admin: SupabaseClient = getAdmin(),
): Promise<GammaLeaseState> {
  const { data } = await admin
    .from('gamma_controller_leases')
    .select('controller_id, lease_expires_at, remote_hold_until')
    .eq('session_id', sessionId)
    .single();
  const now = Date.now();
  const expires = Date.parse((data?.lease_expires_at as string | null) ?? '');
  const remoteHold = Date.parse((data?.remote_hold_until as string | null) ?? '');
  return {
    granted:
      data?.controller_id === controllerId &&
      Number.isFinite(expires) &&
      expires > now &&
      (!Number.isFinite(remoteHold) || remoteHold <= now),
    activeControllerId: (data?.controller_id as string | null) ?? null,
    leaseExpiresAt: (data?.lease_expires_at as string | null) ?? null,
    remoteHoldUntil: (data?.remote_hold_until as string | null) ?? null,
  };
}
