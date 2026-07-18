import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { Card, Pill } from '@/components/shared/ui';
import { Wordmark } from '@/components/landing/decor';

export const metadata: Metadata = {
  title: 'Ops dashboard',
  description: 'Admin-only PulseDeck bug, error and usage dashboard.',
};

type AdminRole = 'owner' | 'admin';
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BUG_STATUSES = ['new', 'triaged', 'in_progress', 'waiting', 'resolved', 'closed', 'wont_fix'] as const;
const ERROR_STATUSES = ['new', 'triaged', 'resolved', 'ignored'] as const;
const ALL_STATUSES = ['new', 'triaged', 'in_progress', 'waiting', 'resolved', 'closed', 'wont_fix', 'ignored'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical', 'info', 'warning', 'error', 'fatal'] as const;

type BugStatus = (typeof BUG_STATUSES)[number];
type ErrorStatus = (typeof ERROR_STATUSES)[number];

type OpsFilters = {
  status: string;
  severity: string;
  feature: string;
  q: string;
};

type BugReport = {
  id: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  category: string;
  route: string | null;
  reporter_email: string | null;
  created_at: string;
};

type ClientError = {
  id: string;
  message: string;
  route: string | null;
  source: string;
  severity: 'info' | 'warning' | 'error' | 'fatal';
  status: string;
  occurred_at: string;
};

type ErrorGroup = {
  fingerprint: string;
  message_sample: string;
  route: string | null;
  source: string;
  severity: string;
  status: string;
  occurrence_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

type AppEvent = {
  id: string;
  event_name: string;
  feature_key: string | null;
  route: string | null;
  event_source: string;
  occurred_at: string;
};

type EventDaily = {
  event_date: string;
  feature_key: string;
  event_name: string;
  event_count: number;
  signed_in_users: number;
};

type FeatureHealth = {
  feature_key: string;
  name: string;
  category: string;
  status: string;
  route_pattern: string | null;
  events_7d: number;
  errors_7d: number;
  reports_7d: number;
  last_event_at: string | null;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined> | undefined): OpsFilters {
  const status = first(params?.status) ?? '';
  const severity = first(params?.severity) ?? '';
  const feature = first(params?.feature) ?? '';
  const q = (first(params?.q) ?? '').trim().slice(0, 80);

  return {
    status: ALL_STATUSES.includes(status as (typeof ALL_STATUSES)[number]) ? status : '',
    severity: SEVERITIES.includes(severity as (typeof SEVERITIES)[number]) ? severity : '',
    feature: feature.replace(/[^a-z0-9_.:-]/gi, '').slice(0, 80),
    q,
  };
}

function matchesSearch(values: Array<string | null | undefined>, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(needle));
}

const fmt = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function when(value: string | null | undefined) {
  if (!value) return '—';
  return fmt.format(new Date(value));
}

function n(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString();
}

function sum<T>(rows: T[], read: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + Number(read(row) ?? 0), 0);
}

function severityTone(severity: string): 'accent' | 'live' | 'dim' | 'default' {
  if (severity === 'critical' || severity === 'fatal' || severity === 'high') return 'live';
  if (severity === 'medium' || severity === 'warning') return 'accent';
  if (severity === 'low' || severity === 'info') return 'dim';
  return 'default';
}

function statusTone(status: string): 'accent' | 'live' | 'dim' | 'default' {
  if (status === 'new') return 'live';
  if (status === 'in_progress' || status === 'triaged') return 'accent';
  if (status === 'resolved' || status === 'closed' || status === 'ignored') return 'dim';
  return 'default';
}

function QueryWarning({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
      Some dashboard data could not load: {errors.join('; ')}
    </div>
  );
}

async function requireAdminSupabase() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin/ops');

  const supabase = await createSupabaseServer();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: AdminRole }>();

  if (!admin) redirect('/studio');
  return { supabase, admin };
}

async function updateBugStatus(formData: FormData) {
  'use server';

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !BUG_STATUSES.includes(status as BugStatus)) return;

  const { supabase } = await requireAdminSupabase();
  const terminal = ['resolved', 'closed', 'wont_fix'].includes(status);
  const { error } = await supabase
    .from('bug_reports')
    .update({ status, resolved_at: terminal ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) throw new Error('Could not update bug report status.');
  revalidatePath('/admin/ops');
}

async function updateErrorStatus(formData: FormData) {
  'use server';

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !ERROR_STATUSES.includes(status as ErrorStatus)) return;

  const { supabase } = await requireAdminSupabase();
  const { error } = await supabase
    .from('client_errors')
    .update({ status })
    .eq('id', id);

  if (error) throw new Error('Could not update error status.');
  revalidatePath('/admin/ops');
}

async function updateErrorGroupStatus(formData: FormData) {
  'use server';

  const fingerprint = String(formData.get('fingerprint') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!fingerprint || !ERROR_STATUSES.includes(status as ErrorStatus)) return;

  const { supabase } = await requireAdminSupabase();
  const { error } = await supabase
    .from('client_errors')
    .update({ status })
    .eq('fingerprint', fingerprint);

  if (error) throw new Error('Could not update grouped error status.');
  revalidatePath('/admin/ops');
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-dim">{label}</p>
      <p className="mt-3 text-3xl font-extrabold tabular-nums text-fg">{value}</p>
      <p className="mt-2 min-h-10 text-sm leading-snug text-fg-dim">{hint}</p>
    </Card>
  );
}

async function loadOpsData(filters: OpsFilters) {
  const supabase = await createSupabaseServer();

  let bugQuery = supabase
    .from('bug_reports')
    .select('id, title, description, severity, status, category, route, reporter_email, created_at');
  if (filters.status && BUG_STATUSES.includes(filters.status as BugStatus)) bugQuery = bugQuery.eq('status', filters.status);
  if (filters.severity && ['low', 'medium', 'high', 'critical'].includes(filters.severity)) {
    bugQuery = bugQuery.eq('severity', filters.severity);
  }

  let errorQuery = supabase
    .from('client_errors')
    .select('id, message, route, source, severity, status, occurred_at');
  if (filters.status && ERROR_STATUSES.includes(filters.status as ErrorStatus)) {
    errorQuery = errorQuery.eq('status', filters.status);
  }
  if (filters.severity && ['info', 'warning', 'error', 'fatal'].includes(filters.severity)) {
    errorQuery = errorQuery.eq('severity', filters.severity);
  }

  let groupQuery = supabase
    .from('ops_error_groups')
    .select('fingerprint, message_sample, route, source, severity, status, occurrence_count, first_seen_at, last_seen_at');
  if (filters.status && ERROR_STATUSES.includes(filters.status as ErrorStatus)) {
    groupQuery = groupQuery.eq('status', filters.status);
  }
  if (filters.severity && ['info', 'warning', 'error', 'fatal'].includes(filters.severity)) {
    groupQuery = groupQuery.eq('severity', filters.severity);
  }

  let eventQuery = supabase
    .from('app_events')
    .select('id, event_name, feature_key, route, event_source, occurred_at');
  if (filters.feature) eventQuery = eventQuery.eq('feature_key', filters.feature);

  let dailyQuery = supabase
    .from('ops_event_daily')
    .select('event_date, feature_key, event_name, event_count, signed_in_users');
  if (filters.feature) dailyQuery = dailyQuery.eq('feature_key', filters.feature);

  const [
    bugs,
    errors,
    groups,
    events,
    daily,
    features,
  ] = await Promise.all([
    bugQuery
      .order('created_at', { ascending: false })
      .limit(50),
    errorQuery
      .order('occurred_at', { ascending: false })
      .limit(50),
    groupQuery
      .order('last_seen_at', { ascending: false })
      .limit(20),
    eventQuery
      .order('occurred_at', { ascending: false })
      .limit(50),
    dailyQuery
      .order('event_date', { ascending: false })
      .limit(50),
    supabase
      .from('ops_feature_health')
      .select('feature_key, name, category, status, route_pattern, events_7d, errors_7d, reports_7d, last_event_at')
      .order('errors_7d', { ascending: false })
      .order('reports_7d', { ascending: false })
      .order('events_7d', { ascending: false }),
  ]);

  const queryErrors = [
    bugs.error?.message,
    errors.error?.message,
    groups.error?.message,
    events.error?.message,
    daily.error?.message,
    features.error?.message,
  ].filter(Boolean) as string[];

  return {
    queryErrors,
    bugs: ((bugs.data ?? []) as BugReport[]).filter((bug) =>
      matchesSearch([bug.title, bug.description, bug.route, bug.reporter_email], filters.q),
    ),
    errors: ((errors.data ?? []) as ClientError[]).filter((error) =>
      matchesSearch([error.message, error.route, error.source], filters.q),
    ),
    groups: ((groups.data ?? []) as ErrorGroup[]).filter((group) =>
      matchesSearch([group.message_sample, group.route, group.source], filters.q),
    ),
    events: (events.data ?? []) as AppEvent[],
    daily: (daily.data ?? []) as EventDaily[],
    features: (features.data ?? []) as FeatureHealth[],
  };
}

export default async function OpsDashboardPage({ searchParams }: { searchParams?: SearchParams }) {
  const { admin } = await requireAdminSupabase();
  const filters = parseFilters(await searchParams);

  const data = await loadOpsData(filters);
  const openBugs = data.bugs.filter((bug) => !['resolved', 'closed', 'wont_fix'].includes(bug.status)).length;
  const activeErrorGroups = data.groups.filter((group) => group.status !== 'resolved' && group.status !== 'ignored').length;
  const events7d = sum(data.features, (feature) => feature.events_7d);
  const featuresNeedingAttention = data.features.filter(
    (feature) => Number(feature.errors_7d) > 0 || Number(feature.reports_7d) > 0,
  ).length;

  return (
    <main className="min-h-dvh bg-ink px-5 pb-12 sm:px-8">
      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 py-5">
        <Link href="/" aria-label="PulseDeck home">
          <Wordmark />
        </Link>
        <div className="mr-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-dim">Admin</p>
          <h1 className="text-2xl font-extrabold text-fg">Ops dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="accent">{admin.role}</Pill>
          <Link
            href="/studio"
            className="inline-flex min-h-[40px] items-center rounded-full border border-edge px-4 text-sm font-semibold text-fg-dim transition-colors hover:border-accent/50 hover:text-fg"
          >
            Studio
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <QueryWarning errors={data.queryErrors} />

        <Card className="p-5">
          <form className="grid gap-4 lg:grid-cols-[1fr_180px_180px_220px_auto]">
            <label className="grid gap-2 text-sm font-semibold text-fg">
              Search
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="Title, message, route, reporter"
                className="min-h-[44px] rounded-lg border border-edge bg-panel-2 px-3 text-sm font-normal text-fg outline-none transition-colors placeholder:text-fg-dim/70 focus:border-accent"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-fg">
              Status
              <select
                name="status"
                defaultValue={filters.status}
                className="min-h-[44px] rounded-lg border border-edge bg-panel-2 px-3 text-sm font-normal text-fg outline-none transition-colors focus:border-accent"
              >
                <option value="">All statuses</option>
                {ALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-fg">
              Severity
              <select
                name="severity"
                defaultValue={filters.severity}
                className="min-h-[44px] rounded-lg border border-edge bg-panel-2 px-3 text-sm font-normal text-fg outline-none transition-colors focus:border-accent"
              >
                <option value="">All severities</option>
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-fg">
              Feature
              <select
                name="feature"
                defaultValue={filters.feature}
                className="min-h-[44px] rounded-lg border border-edge bg-panel-2 px-3 text-sm font-normal text-fg outline-none transition-colors focus:border-accent"
              >
                <option value="">All features</option>
                {data.features.map((feature) => (
                  <option key={feature.feature_key} value={feature.feature_key}>
                    {feature.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                Apply
              </button>
              <Link
                href="/admin/ops"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-edge px-4 text-sm font-semibold text-fg-dim transition-colors hover:border-accent/50 hover:text-fg"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open bugs" value={n(openBugs)} hint="Recent reports still needing review." />
          <StatCard label="Error groups" value={n(activeErrorGroups)} hint="Unresolved recurring error fingerprints." />
          <StatCard label="Events, 7 days" value={n(events7d)} hint="Tracked usage across known features." />
          <StatCard
            label="Features flagged"
            value={n(featuresNeedingAttention)}
            hint="Features with reports or errors in the last week."
          />
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-edge px-5 py-4">
              <h2 className="text-lg font-bold text-fg">Latest bugs and feedback</h2>
            </div>
            <div className="divide-y divide-edge">
              {data.bugs.length === 0 ? (
                <EmptyState label="No bug reports yet." />
              ) : (
                data.bugs.map((bug) => (
                  <article key={bug.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={severityTone(bug.severity)}>{bug.severity}</Pill>
                        <Pill tone={statusTone(bug.status)}>{bug.status}</Pill>
                        <Pill tone="dim">{bug.category}</Pill>
                      </div>
                      <h3 className="mt-2 break-words text-sm font-bold text-fg">{bug.title}</h3>
                      <p className="mt-1 break-words text-xs text-fg-dim">
                        {bug.route ?? 'Unknown route'} · {bug.reporter_email ?? 'No reporter email'}
                      </p>
                      {bug.description ? (
                        <p className="mt-2 line-clamp-3 break-words text-xs leading-relaxed text-fg-dim">
                          {bug.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-3 justify-items-start md:justify-items-end">
                      <time className="text-xs tabular-nums text-fg-dim">{when(bug.created_at)}</time>
                      <StatusForm
                        id={bug.id}
                        current={bug.status}
                        statuses={BUG_STATUSES}
                        action={updateBugStatus}
                        fieldName="id"
                      />
                    </div>
                  </article>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-edge px-5 py-4">
              <h2 className="text-lg font-bold text-fg">Grouped errors</h2>
            </div>
            <div className="divide-y divide-edge">
              {data.groups.length === 0 ? (
                <EmptyState label="No client errors captured yet." />
              ) : (
                data.groups.map((group) => (
                  <article key={group.fingerprint} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={severityTone(group.severity)}>{group.severity}</Pill>
                      <Pill tone={statusTone(group.status)}>{group.status}</Pill>
                      <span className="ml-auto text-xs font-semibold tabular-nums text-fg">
                        {n(group.occurrence_count)}x
                      </span>
                    </div>
                    <h3 className="mt-2 break-words text-sm font-bold text-fg">{group.message_sample}</h3>
                    <p className="mt-1 break-words text-xs text-fg-dim">
                      {group.route ?? 'Unknown route'} · {group.source} · last {when(group.last_seen_at)}
                    </p>
                    <div className="mt-3">
                      <StatusForm
                        id={group.fingerprint}
                        current={group.status}
                        statuses={ERROR_STATUSES}
                        action={updateErrorGroupStatus}
                        fieldName="fingerprint"
                      />
                    </div>
                  </article>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-edge px-5 py-4">
              <h2 className="text-lg font-bold text-fg">Feature health</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-panel-2 text-xs uppercase tracking-[0.12em] text-fg-dim">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Feature</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Events</th>
                    <th className="px-3 py-3 text-right font-semibold">Errors</th>
                    <th className="px-3 py-3 text-right font-semibold">Reports</th>
                    <th className="px-5 py-3 font-semibold">Last event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {data.features.map((feature) => (
                    <tr key={feature.feature_key}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-fg">{feature.name}</p>
                        <p className="text-xs text-fg-dim">{feature.route_pattern ?? feature.feature_key}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone={feature.status === 'live' ? 'dim' : 'accent'}>{feature.status}</Pill>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-fg">{n(feature.events_7d)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-red">{n(feature.errors_7d)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-fg">{n(feature.reports_7d)}</td>
                      <td className="px-5 py-3 text-xs tabular-nums text-fg-dim">{when(feature.last_event_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-edge px-5 py-4">
              <h2 className="text-lg font-bold text-fg">Latest events</h2>
            </div>
            <div className="divide-y divide-edge">
              {data.events.length === 0 ? (
                <EmptyState label="No usage events captured yet." />
              ) : (
                data.events.slice(0, 24).map((event) => (
                  <article key={event.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-fg">{event.event_name}</p>
                      <p className="break-words text-xs text-fg-dim">
                        {event.feature_key ?? 'uncategorized'} · {event.route ?? 'Unknown route'} · {event.event_source}
                      </p>
                    </div>
                    <time className="text-xs tabular-nums text-fg-dim">{when(event.occurred_at)}</time>
                  </article>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-edge px-5 py-4">
              <h2 className="text-lg font-bold text-fg">Recent client errors</h2>
            </div>
            <div className="divide-y divide-edge">
              {data.errors.length === 0 ? (
                <EmptyState label="No raw errors captured yet." />
              ) : (
                data.errors.map((error) => (
                  <article key={error.id} className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={severityTone(error.severity)}>{error.severity}</Pill>
                      <Pill tone={statusTone(error.status)}>{error.status}</Pill>
                      <span className="ml-auto text-xs tabular-nums text-fg-dim">{when(error.occurred_at)}</span>
                    </div>
                    <h3 className="mt-2 break-words text-sm font-bold text-fg">{error.message}</h3>
                    <p className="mt-1 break-words text-xs text-fg-dim">{error.route ?? 'Unknown route'} · {error.source}</p>
                    <div className="mt-3">
                      <StatusForm
                        id={error.id}
                        current={error.status}
                        statuses={ERROR_STATUSES}
                        action={updateErrorStatus}
                        fieldName="id"
                      />
                    </div>
                  </article>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-edge px-5 py-4">
              <h2 className="text-lg font-bold text-fg">Daily event summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-panel-2 text-xs uppercase tracking-[0.12em] text-fg-dim">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Feature</th>
                    <th className="px-3 py-3 font-semibold">Event</th>
                    <th className="px-5 py-3 text-right font-semibold">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {data.daily.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState label="No daily event rows yet." />
                      </td>
                    </tr>
                  ) : (
                    data.daily.map((row) => (
                      <tr key={`${row.event_date}-${row.feature_key}-${row.event_name}`}>
                        <td className="px-5 py-3 text-xs tabular-nums text-fg-dim">{row.event_date}</td>
                        <td className="px-3 py-3 text-fg">{row.feature_key}</td>
                        <td className="px-3 py-3 text-fg-dim">{row.event_name}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-semibold text-fg">
                          {n(row.event_count)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="px-5 py-8 text-center text-sm text-fg-dim">{label}</p>;
}

function StatusForm({
  id,
  current,
  statuses,
  action,
  fieldName,
}: {
  id: string;
  current: string;
  statuses: readonly string[];
  action: (formData: FormData) => Promise<void>;
  fieldName: 'id' | 'fingerprint';
}) {
  return (
    <form action={action} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <input type="hidden" name={fieldName} value={id} />
      <select
        name="status"
        defaultValue={current}
        aria-label="Status"
        className="min-h-[36px] rounded-lg border border-edge bg-panel-2 px-2 text-xs font-semibold text-fg outline-none transition-colors focus:border-accent"
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-edge px-3 text-xs font-semibold text-fg-dim transition-colors hover:border-accent/50 hover:text-fg"
      >
        Update
      </button>
    </form>
  );
}
