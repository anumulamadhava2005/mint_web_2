// ── Client IP resolution for rate limiting ───────────────────
// Returns the originating client IP, or null when it cannot be
// attributed to a specific client.
//
// Rate limiters MUST treat a null result as "do not rate limit",
// rather than bucketing everyone under a shared "unknown" key.
// Otherwise a single shared bucket (e.g. exported apps hitting a
// dev server with no proxy, so no x-forwarded-for header) trips the
// limit for ALL clients after a handful of attempts — which is what
// caused "Too many signup attempts" during local testing.
//
// In production we sit behind a proxy that sets x-forwarded-for /
// x-real-ip, so real clients are still attributed and limited.
export function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // First entry is the original client; the rest are proxies.
    const first = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean)[0];
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();
  return null;
}
