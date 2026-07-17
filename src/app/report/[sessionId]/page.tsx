import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Spinner } from '@/components/shared/ui';
import { ReportClient } from '@/components/report/report-client';

export const metadata: Metadata = {
  title: 'Session report — PulseDeck',
  description: 'Post-session results, leaderboard, and Q&A log.',
};

// /report/[sessionId] — presenter-only post-session report.
// Next.js 16: params is a Promise. useSearchParams in the client shell
// requires a Suspense boundary here.
export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-fg-dim" role="status">
            Loading session report…
          </p>
        </main>
      }
    >
      <ReportClient sessionId={sessionId} />
    </Suspense>
  );
}
