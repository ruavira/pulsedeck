import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PulseDeck',
  description: 'How PulseDeck handles presenter and audience data.',
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Effective date: July 11, 2026.</strong> PulseDeck is operated by Ruavira
        Collective Inc. (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what data
        PulseDeck handles when you present with it or join a session from the audience —
        including when PulseDeck runs inside Microsoft PowerPoint via our add-in.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>No accounts.</strong> Neither presenters nor audience members create accounts,
          passwords, or profiles.
        </li>
        <li>
          <strong>No tracking.</strong> We use no advertising trackers, no analytics cookies, and
          we never sell or share data with third parties for marketing.
        </li>
        <li>
          <strong>Your content is yours.</strong> Decks, responses, and results belong to the
          presenter and export freely at any time.
        </li>
      </ul>

      <h2>What we collect from audience members</h2>
      <p>
        Joining a session requires no personal information. When you participate we store: the
        optional nickname you choose, your answers to activities (votes, words, text responses,
        quiz answers, questions), and a random device identifier kept in your browser so your
        submissions aren&rsquo;t counted twice. We do not collect your name, email, phone number,
        or precise location, and we cannot identify you from a nickname.
      </p>

      <h2>What we collect from presenters</h2>
      <p>
        Deck content (slides, images, video you upload) and session results. Access to a deck is
        controlled by a presenter key stored in your browser — treat the key like a password. We
        do not collect presenter names or emails.
      </p>

      <h2>Where data lives</h2>
      <p>
        Data is stored with Supabase (our database and storage provider) in the Canada
        (ca-central-1) region, and the application is served by Netlify. Both process data on our
        behalf under their own security and privacy commitments. Data is encrypted in transit.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        PulseDeck sets no advertising or analytics cookies. We use browser local storage strictly
        to make the product work: your theme choice, your device identifier and nickname for a
        session, and (for presenters) deck references and presenter keys. The PowerPoint add-in
        stores only the stage link you paste into it, locally in the add-in&rsquo;s own storage.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Session results are kept so presenters can review and export reports. Presenters can
        delete a deck (and its sessions and results) from the studio at any time, which removes
        the data permanently. To request removal of a specific response, contact us with the
        session code and details.
      </p>

      <h2>The PowerPoint add-in (PulseDeck Live)</h2>
      <p>
        <strong>PulseDeck Live</strong>, our add-in for Microsoft PowerPoint, embeds your live
        PulseDeck stage inside a slide. It requires no account or sign-in, reads nothing from
        your presentation document beyond what Office requires to display the pane, and sends
        nothing about your document to us. It talks only to pulsedeck-live.netlify.app, and the
        only thing it stores is the stage link you paste into it, locally on your device. This
        policy covers the PulseDeck Live add-in and the PulseDeck web service alike.
      </p>

      <h2>Children</h2>
      <p>
        Audience participation collects no personal information beyond an optional nickname, and
        profanity filtering is always on. Presenters running sessions with minors are responsible
        for appropriate supervision and for the content of their decks.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We&rsquo;ll update this page when the policy changes and revise the effective date above.
        Questions or requests: <a href="mailto:support@ruavira.org">support@ruavira.org</a>.
      </p>
    </>
  );
}
