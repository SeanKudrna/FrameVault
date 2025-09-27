import type { NextRequest } from "next/server";
import { apiError, ApiError } from "@/lib/api";
import { prepareExportPayload } from "@/app/api/export/shared";
import { isRateLimitError } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const payload = await prepareExportPayload(request);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const simplified = {
          profile: {
            username: payload.profile.username,
            displayName: payload.profile.display_name,
            plan: payload.profile.plan,
          },
          collections: payload.collections.map((collection) => ({
            title: collection.title,
            description: collection.description,
            movies: collection.items.map((item) => ({
              title: item.movie.title ?? "Untitled",
              note: item.note ?? null,
            })),
          })),
        };

        controller.enqueue(encoder.encode(JSON.stringify(simplified)));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="framevault-export.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiError(error.code, error.message, error.status);
    }
    if (isRateLimitError(error)) {
      const response = apiError("rate_limited", "Too many export requests", 429);
      response.headers.set("Retry-After", error.retryAfter.toString());
      return response;
    }
    console.error("/api/export.json error", error);
    return apiError("internal_error", "Unexpected error", 500);
  }
}
