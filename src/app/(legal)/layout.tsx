// Shared shell for the public policy/support pages (/privacy, /terms, /support).
// Static, prose-styled, and deliberately plain — these are AppSource-required
// pages, not marketing surfaces.
import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink">
      <header className="mx-auto w-full max-w-3xl px-6 py-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-fg">
          PulseDeck
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16">
        <article className="[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-fg [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-fg [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-fg-dim [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_li]:leading-relaxed [&_li]:text-fg-dim [&_a]:font-medium [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_strong]:text-fg">
          {children}
        </article>
      </main>
      <footer className="border-t border-edge">
        <nav
          aria-label="Policies"
          className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-sm text-fg-dim"
        >
          <Link href="/" className="hover:text-fg">
            Home
          </Link>
          <Link href="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-fg">
            Terms
          </Link>
          <Link href="/support" className="hover:text-fg">
            Support
          </Link>
        </nav>
      </footer>
    </div>
  );
}
