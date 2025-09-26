/**
 * API route that proxies TMDB search queries. All heavy lifting happens in the
 * shared handler so the route remains a thin wrapper for error logging.
 */

import type { NextRequest } from "next/server";
import { handleSearch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  try {
    return await handleSearch(request);
  } catch (error) {
    console.error("/api/tmdb/search error", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "Unexpected error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
