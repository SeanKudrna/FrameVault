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
