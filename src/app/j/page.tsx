// /j — manual join-code entry (server wrapper; the form itself is a client component).
import type { Metadata } from 'next';
import { CodeEntry } from '@/components/audience/code-entry';

export const metadata: Metadata = {
  title: 'Join a session',
  description: 'Enter the 6-character code on the big screen to join a live PulseDeck session.',
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.bad === 'string' ? sp.bad : undefined;
  const badCode = raw
    ? raw
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6) || undefined
    : undefined;
  return <CodeEntry badCode={badCode} />;
}
