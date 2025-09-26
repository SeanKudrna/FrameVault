/**
 * Utilities for building consistent API responses across server actions and
 * Next.js route handlers. Centralising these helpers keeps every edge case
 * (validation failures, rate limits, etc.) aligned so that consuming clients
 * can rely on predictable shapes regardless of where a response originated.
 */

/**
 * Standard JSON payload returned by API routes when an error occurs. The
 * `error` field is a short, machine-friendly code whereas `message` surfaces a
 * human-readable explanation that can be rendered directly to users.
 */
export interface ApiErrorPayload {
  error: string;
  message: string;
}

/**
 * Helper for returning a JSON error response with a consistent structure and
 * status code. Wrapping the response construction avoids subtle inconsistencies
 * (missing headers, incorrect casing) when the pattern is repeated across many
 * server actions.
 */
export function apiError(error: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Serialises the provided data as JSON while preserving any custom response
 * init options. This mirrors `NextResponse.json` but keeps the abstraction
 * lightweight so non-Next contexts (e.g., server actions) can share the helper.
 */
export function apiJson<T>(data: T, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Error class that carries an HTTP status code and short code for routing
 * failures through shared handlers. Throwing an `ApiError` allows caller code to
 * inspect the `status` and `code` properties and translate them into toast
 * notifications or custom UI without having to parse strings.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
