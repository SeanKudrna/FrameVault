/**
 * Attempts to determine the originating client IP address from common proxy
 * headers. API routes use this helper to enforce per-IP rate limits without
 * caring which hosting provider (Vercel, Cloudflare, etc.) is in front of the
 * app. The header precedence mirrors Vercel's behaviour—`x-forwarded-for` first
 * followed by `x-real-ip`—with a final fallback to Cloudflare's header.
 */
export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [ip] = forwarded.split(",");
    if (ip) return ip.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return request.headers.get("cf-connecting-ip");
}
