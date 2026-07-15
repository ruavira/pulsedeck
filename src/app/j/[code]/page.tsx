// /j/[code] — the audience phone app for a live session.
import type { Metadata } from 'next';
import { AudienceApp } from '@/components/audience/audience-app';
import { AudiencePrefsProvider } from '@/components/audience/prefs';

export const metadata: Metadata = {
  title: 'Live session',
  description: 'You are joining a live PulseDeck session.',
};

export default async function AudiencePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = decodeURIComponent(code)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);
  return (
    <AudiencePrefsProvider>
      <AudienceApp code={clean} />
    </AudiencePrefsProvider>
  );
}
