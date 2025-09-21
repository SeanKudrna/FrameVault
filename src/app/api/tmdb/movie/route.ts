import type { NextRequest } from "next/server";
import { handleMovie } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  try {
    return await handleMovie(request);
  } catch (error) {
    console.error("/api/tmdb/movie error", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "Unexpected error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
