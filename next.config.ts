import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // PulseDeck Embeds are host-agnostic, read-only widgets designed to live
        // inside a third-party iframe (Gamma, Notion, any site). Allow framing
        // from any host and make sure no X-Frame-Options: DENY is applied here.
        // Scoped to /embed/* only — every other route keeps its default framing.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
    ];
  },
};

export default nextConfig;
