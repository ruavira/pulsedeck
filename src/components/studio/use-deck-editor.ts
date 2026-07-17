'use client';
// Editor state core: deck state + 50-step undo/redo history + debounced autosave
// (PUT /api/decks/[id]) with offline retry.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck } from '@/lib/types';
import { saveDeck } from './studio-api';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const HISTORY_LIMIT = 50;
const AUTOSAVE_MS = 1500;
const RETRY_MS = 4000;
const COALESCE_MS = 800;

export interface DeckEditorApi {
  deck: Deck;
  /** Commit a change. `coalesce` groups rapid edits (typing) into one history step. */
  update: (fn: (d: Deck) => Deck, opts?: { coalesce?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: SaveState;
  saveNow: () => void;
}

export function useDeckEditor(opts: {
  deckId: string;
  presenterKey: string;
  initial: Deck;
  onSaved?: (deck: Deck) => void;
}): DeckEditorApi {
  const { deckId, presenterKey } = opts;
  const [deck, setDeckState] = useState<Deck>(opts.initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [histo, setHisto] = useState({ canUndo: false, canRedo: false });

  const deckRef = useRef(deck);
  const past = useRef<Deck[]>([]);
  const future = useRef<Deck[]>([]);
  const lastPushAt = useRef(0);
  const dirty = useRef(false);
  const saving = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateRef = useRef<SaveState>('saved');
  const onSavedRef = useRef(opts.onSaved);
  onSavedRef.current = opts.onSaved;

  const setSave = useCallback((s: SaveState) => {
    saveStateRef.current = s;
    setSaveState(s);
  }, []);

  // Function refs so schedule/save can reference each other without ordering issues.
  const doSaveRef = useRef<() => void>(() => {});
  const scheduleSaveRef = useRef<() => void>(() => {});

  scheduleSaveRef.current = () => {
    dirty.current = true;
    if (saveStateRef.current !== 'saving') setSave('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSaveRef.current(), AUTOSAVE_MS);
  };

  doSaveRef.current = () => {
    if (saving.current) return; // in-flight save re-schedules itself if still dirty
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saving.current = true;
    dirty.current = false;
    setSave('saving');
    const snapshot = deckRef.current;
    saveDeck(deckId, presenterKey, snapshot).then(
      () => {
        saving.current = false;
        onSavedRef.current?.(snapshot);
        if (dirty.current) scheduleSaveRef.current();
        else setSave('saved');
      },
      () => {
        saving.current = false;
        dirty.current = true;
        setSave('error');
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => doSaveRef.current(), RETRY_MS);
      },
    );
  };

  const syncHisto = useCallback(() => {
    setHisto({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 });
  }, []);

  const update = useCallback(
    (fn: (d: Deck) => Deck, updateOpts?: { coalesce?: boolean }) => {
      const prev = deckRef.current;
      const now = Date.now();
      const coalesce = updateOpts?.coalesce === true && now - lastPushAt.current < COALESCE_MS;
      if (!coalesce) {
        past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(prev)];
      }
      lastPushAt.current = now;
      future.current = [];
      const next = fn(prev);
      deckRef.current = next;
      setDeckState(next);
      syncHisto();
      scheduleSaveRef.current();
    },
    [syncHisto],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current = [structuredClone(deckRef.current), ...future.current].slice(0, HISTORY_LIMIT);
    deckRef.current = prev;
    setDeckState(prev);
    lastPushAt.current = 0; // next typed edit starts a fresh history step
    syncHisto();
    scheduleSaveRef.current();
  }, [syncHisto]);

  const redo = useCallback(() => {
    const next = future.current.shift();
    if (!next) return;
    past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), structuredClone(deckRef.current)];
    deckRef.current = next;
    setDeckState(next);
    lastPushAt.current = 0;
    syncHisto();
    scheduleSaveRef.current();
  }, [syncHisto]);

  const saveNow = useCallback(() => {
    if (saveStateRef.current === 'saved' || saveStateRef.current === 'saving') return;
    doSaveRef.current();
  }, []);

  // Warn before leaving with unsaved changes; try a best-effort keepalive flush.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStateRef.current !== 'saved') {
        e.preventDefault();
        void saveDeck(deckId, presenterKey, deckRef.current, true).catch(() => undefined);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [deckId, presenterKey]);

  // Cleanup timers on unmount.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  return {
    deck,
    update,
    undo,
    redo,
    canUndo: histo.canUndo,
    canRedo: histo.canRedo,
    saveState,
    saveNow,
  };
}
