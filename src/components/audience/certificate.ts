'use client';
// Client-side Certificate of Participation generator. Builds a self-contained SVG
// (no external assets → no canvas taint) and downloads it as a PNG. Gives
// participants filable proof of attendance (useful for CPD), with zero server work.

interface CertOpts {
  name: string;
  deckTitle: string;
  code: string;
  dateStr: string;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

function certSvg({ name, deckTitle, code, dateStr }: CertOpts): string {
  const W = 1200;
  const H = 850;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="18" fill="none" stroke="#1e88d2" stroke-width="3"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="12" fill="none" stroke="#d8e6f0" stroke-width="2"/>
  <circle cx="${W / 2}" cy="180" r="46" fill="#0a3d62"/>
  <text x="${W / 2}" y="196" font-family="Georgia, serif" font-size="44" fill="#ffffff" text-anchor="middle">✓</text>
  <text x="${W / 2}" y="290" font-family="Georgia, serif" font-size="46" font-weight="700" fill="#0a3d62" text-anchor="middle">Certificate of Participation</text>
  <text x="${W / 2}" y="345" font-family="system-ui, sans-serif" font-size="20" fill="#5c7a93" text-anchor="middle" letter-spacing="3">THIS CERTIFIES THAT</text>
  <text x="${W / 2}" y="430" font-family="Georgia, serif" font-size="56" font-weight="700" fill="#1e88d2" text-anchor="middle">${escapeXml(name)}</text>
  <line x1="${W / 2 - 260}" y1="460" x2="${W / 2 + 260}" y2="460" stroke="#d8e6f0" stroke-width="2"/>
  <text x="${W / 2}" y="520" font-family="system-ui, sans-serif" font-size="22" fill="#5c7a93" text-anchor="middle">actively participated in the live session</text>
  <text x="${W / 2}" y="565" font-family="Georgia, serif" font-size="30" font-weight="700" fill="#0a3d62" text-anchor="middle">${escapeXml(deckTitle)}</text>
  <text x="${W / 2}" y="690" font-family="system-ui, sans-serif" font-size="20" fill="#0a3d62" text-anchor="middle">${escapeXml(dateStr)}</text>
  <text x="${W / 2}" y="722" font-family="system-ui, sans-serif" font-size="15" fill="#93a0c2" text-anchor="middle">Session ${escapeXml(code)} · Issued via PulseDeck</text>
  <text x="${W / 2}" y="792" font-family="system-ui, sans-serif" font-size="13" fill="#c3ccdd" text-anchor="middle">Add CPD hours or accreditation details with your programme lead.</text>
</svg>`;
}

/** Render the certificate SVG to a PNG and trigger a download. */
export async function downloadCertificate(opts: CertOpts): Promise<void> {
  const svg = certSvg(opts);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2; // crisp export
      const canvas = document.createElement('canvas');
      canvas.width = 1200 * scale;
      canvas.height = 850 * scale;
      const cx = canvas.getContext('2d');
      if (!cx) return resolve();
      cx.scale(scale, scale);
      cx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return resolve();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PulseDeck-Certificate-${opts.name.replace(/[^a-z0-9]+/gi, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => resolve();
    img.src = svgUrl;
  });
}
