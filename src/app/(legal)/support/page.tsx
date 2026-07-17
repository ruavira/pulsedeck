import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support — PulseDeck',
  description: 'Get help with PulseDeck and the PowerPoint add-in.',
};

export default function SupportPage() {
  return (
    <>
      <h1>Support</h1>
      <p>
        Stuck on something? Most questions are answered by the quick guides below; anything else,
        email us and we&rsquo;ll get back to you.
      </p>

      <h2>Quick answers</h2>
      <ul>
        <li>
          <strong>Joining a session:</strong> go to{' '}
          <Link href="/">pulsedeck-live.netlify.app</Link> (or scan the presenter&rsquo;s QR
          code) and type the 6-letter code on the big screen. No app, no account.
        </li>
        <li>
          <strong>Creating a deck:</strong> open <Link href="/studio">the Studio</Link> →{' '}
          <strong>New deck</strong>. You can also import PowerPoint (.pptx), PDF, or Markdown, or
          generate a deck with AI.
        </li>
        <li>
          <strong>Presenting:</strong> in the editor press <strong>Present</strong> — the stage
          link goes on the big screen, the remote link on your phone.
        </li>
        <li>
          <strong>PowerPoint add-in:</strong> insert the PulseDeck Live add-in on a slide, paste
          your session&rsquo;s stage link once, and your live stage (polls, word clouds, quiz
          leaderboard, Q&amp;A) renders inside that slide. Use <em>Change session</em> in the top
          right of the pane to switch sessions.
        </li>
        <li>
          <strong>Getting results out:</strong> every session has a Report with .xlsx, CSV, and
          print/PDF export — open <strong>Sessions</strong> in the editor.
        </li>
        <li>
          <strong>Lost your deck?</strong> Deck access lives in the browser you created it in. If
          you saved your presenter link (with the <code>?key=</code> part), opening it restores
          access on any device.
        </li>
      </ul>

      <h2>Limits worth knowing</h2>
      <ul>
        <li>PowerPoint import up to 300MB; PDF import up to 150 pages.</li>
        <li>Images up to 80MB (auto-compressed); video uploads up to 200MB — or embed YouTube, Vimeo, and Loom links with no limit.</li>
        <li>Rooms are certified for 1,000 simultaneous participants.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Email <a href="mailto:support@ruavira.org">support@ruavira.org</a> — include
        your session code if your question is about a specific session. We aim to reply within two
        business days.
      </p>

      <p>
        See also: <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link>.
      </p>
    </>
  );
}
