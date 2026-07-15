import type { Metadata } from 'next';
import { DeckEditor } from '@/components/studio/deck-editor';

export const metadata: Metadata = {
  title: 'Deck editor',
  description: 'Edit slides, configure live activities and go live with your PulseDeck.',
};

// Next.js 16: params is a Promise — await it before use.
export default async function DeckEditorPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <DeckEditor deckId={deckId} />;
}
