// Presenter phone remote — /remote/[sessionId]?key=<presenterKey>
// Next.js 16: params and searchParams are Promises. The optional ?key= param is
// consumed once by the client (stored to localStorage, then scrubbed from the URL).

import type { Metadata } from 'next';
import { RemoteApp } from '@/components/remote/remote-app';

export const metadata: Metadata = {
  title: 'Presenter remote — PulseDeck',
  robots: { index: false },
};

export default async function RemotePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const key = typeof sp.key === 'string' && sp.key.trim() ? sp.key : null;

  return <RemoteApp sessionId={sessionId} keyFromUrl={key} />;
}
