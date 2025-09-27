import type { NextRequest } from "next/server";
import { apiError, ApiError } from "@/lib/api";
import { prepareExportPayload } from "@/app/api/export/shared";
import { isRateLimitError } from "@/lib/rate-limit";

function escapeCsv(value: unknown) {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const payload = await prepareExportPayload(request);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const newline = "\n";
        const writeRow = (cells: (string | number | boolean | null | undefined)[]) => {
          controller.enqueue(
            encoder.encode(`${cells.map((value) => escapeCsv(value)).join(",")}${newline}`)
          );
        };
        const writeLine = (value: string = "") => {
          controller.enqueue(encoder.encode(`${escapeCsv(value)}${newline}`));
        };

        for (const collection of payload.collections) {
          writeLine();
          writeLine(`Collection: ${collection.title}`);
          if (collection.description) {
            writeLine(`Description: ${collection.description}`);
          }
          writeLine();

          writeRow(["Movie", "Notes"]);

          if (collection.items.length === 0) {
            writeRow(["(No movies yet)", ""]);
          } else {
            for (const item of collection.items) {
              writeRow([
                item.movie.title ?? "Untitled",
                item.note ?? "",
              ]);
            }
          }

          writeLine();
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="framevault-export.csv"`,
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
    console.error("/api/export.csv error", error);
    return apiError("internal_error", "Unexpected error", 500);
  }
}
