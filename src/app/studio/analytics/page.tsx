import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { AnalyticsClient } from '@/components/studio/analytics-client';
import { ReportIssueButton } from '@/components/ops/report-issue-button';

export const metadata: Metadata = {
  title: 'Trainer analytics',
  description:
    'Cross-session engagement trends, question difficulty and learner progress for your PulseDeck sessions.',
};

export default async function AnalyticsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/studio/analytics');
  return (
    <>
      <AnalyticsClient />
      <ReportIssueButton reporterEmail={user.email} />
    </>
  );
}
