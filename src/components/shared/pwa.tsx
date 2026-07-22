'use client';
// PWA plumbing: registers the service worker and exposes an install prompt hook.
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaRegister() {
  useEffect(() => {
    // Never run the PWA service worker inside an iframe — embed widgets are framed
    // by third-party hosts (Gamma, Notion, …) and a SW there only causes trouble.
    if (typeof window !== 'undefined' && window.top !== window.self) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  return null;
}

/** Shows nothing until the browser signals installability; then a subtle install button. */
export function InstallAppButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;
  return (
    <button
      onClick={async () => {
        await deferred.prompt();
        setDeferred(null);
      }}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-edge bg-panel-2 px-5 py-2.5 text-[15px] font-semibold text-fg transition-colors hover:border-accent/60 ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Install PulseDeck app
    </button>
  );
}
