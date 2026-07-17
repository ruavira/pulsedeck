import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use — PulseDeck',
  description: 'The terms that govern use of PulseDeck.',
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p>
        <strong>Effective date: July 11, 2026.</strong> These terms govern your use of PulseDeck
        (pulsedeck-live.netlify.app) and the PulseDeck add-in for Microsoft PowerPoint, operated
        by Ruavira Collective Inc. By using PulseDeck you agree to these terms.
      </p>

      <h2>The service</h2>
      <p>
        PulseDeck lets presenters build interactive presentations — slides, polls, quizzes, word
        clouds, and Q&amp;A — and lets audiences participate from their own devices without
        creating accounts. The service is provided free of charge.
      </p>

      <h2>Your content</h2>
      <p>
        Presenters retain all rights to the decks, media, and materials they upload, and to the
        results their sessions generate. You grant us only the technical license needed to store
        and display that content to your audience while operating the service. Audience responses
        belong to the session&rsquo;s presenter.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Only upload content you have the right to use.</li>
        <li>
          Don&rsquo;t use PulseDeck to harass, defame, or harm others, or to collect personal
          information from audiences beyond what the product itself asks for.
        </li>
        <li>Don&rsquo;t attempt to disrupt sessions you were not invited to, probe, or overload the service.</li>
        <li>Presenters are responsible for their session content and for compliance with laws that apply to their audience.</li>
      </ul>

      <h2>Presenter keys and sessions</h2>
      <p>
        Deck access is controlled by presenter keys. Keep your keys private; anyone with a key can
        edit the deck and drive its sessions. We may end sessions or remove content that violates
        these terms.
      </p>

      <h2>Availability and changes</h2>
      <p>
        PulseDeck is provided &ldquo;as is&rdquo; without warranties of any kind. We work hard to
        keep it fast and reliable, but we don&rsquo;t guarantee uninterrupted availability and may
        change or discontinue features. To the maximum extent permitted by law, Ruavira Collective
        Inc. is not liable for indirect, incidental, or consequential damages arising from use of
        the service.
      </p>

      <h2>The PowerPoint add-in</h2>
      <p>
        The add-in is subject to these same terms. Microsoft is not a party to these terms and has
        no responsibility for the add-in or the service.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:support@ruavira.org">support@ruavira.org</a>.
      </p>
    </>
  );
}
