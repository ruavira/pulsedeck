// Server-side auth helpers for Route Handlers + Server Components.
// getSessionUser(): who is signed in (or null). getUserPlan(): their plan,
// read with the admin client so it's reliable regardless of RLS context.
import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/supabase/admin';
import type { Plan } from '@/lib/plans';

/** The signed-in presenter, or null. Safe to call on any presenter route. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/** A user's current plan. Defaults to 'free' if no profile row (yet) exists. */
export async function getUserPlan(userId: string): Promise<Plan> {
  const admin = getAdmin();
  const { data } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle();
  return (data?.plan as Plan) ?? 'free';
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
}

/**
 * Gate for Pro-only server features (AI generation). Returns a Response to send
 * back when the caller isn't allowed, or null when they may proceed.
 */
export async function proGate(): Promise<Response | null> {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const plan = await getUserPlan(user.id);
  if (plan !== 'pro') return Response.json({ error: 'pro_only' }, { status: 403 });
  return null;
}

/** Full profile row for a user (admin read). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const admin = getAdmin();
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name, plan, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}
