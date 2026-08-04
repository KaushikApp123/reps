import type { NextConfig } from "next";

/**
 * Security headers. The app is a public deployment with a shared demo
 * account, so these are set explicitly rather than left to defaults.
 *
 * No CSP is set here deliberately: Next injects inline scripts for hydration
 * and streaming, so a useful policy needs per-request nonces via the proxy
 * rather than a static header. A wrong CSP that gets loosened to
 * 'unsafe-inline' is worse than none — see the note in proxy.ts.
 */
const securityHeaders = [
  // Stop MIME sniffing turning an upload into an executable content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: nothing here is meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No feature needs these; deny by default.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Vercel serves HTTPS only; make downgrade attempts fail closed.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
