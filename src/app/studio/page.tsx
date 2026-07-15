import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { DeckList } from '@/components/studio/deck-list';
import { ReportIssueButton } from '@/components/ops/report-issue-button';

export const metadata: Metadata = {
  title: 'Studio',
  description:
    'Your PulseDeck library: build interactive decks with live polls, word clouds, quizzes and Q&A — or generate one with AI.',
};

export default async function StudioPage() {
  // The library requires an account; individual decks (/studio/[id]?key=…) stay
  // open so the add-in, existing deep links, and live shows keep working.
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/studio');
  return (
    <>
      <DeckList />
      <ReportIssueButton reporterEmail={user.email} />
    </>
  );
}
