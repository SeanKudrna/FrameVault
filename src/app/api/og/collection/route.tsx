/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const collectionId = url.searchParams.get("collectionId");
  const username = url.searchParams.get("username");
  const slug = url.searchParams.get("slug");

  if (!collectionId && (!username || !slug)) {
    return new Response("Provide collectionId or username + slug", { status: 400 });
  }

  const service = getSupabaseServiceRoleClient();

  let query = service
    .from("collections")
    .select(
      `id, title, description, cover_image_url, is_public, theme, owner:profiles!collections_owner_id_fkey(username, display_name), collection_items(id, tmdb_id, position)`
    )
    .limit(1);

  if (collectionId) {
    query = query.eq("id", collectionId);
  } else {
    query = query.eq("slug", slug!.toLowerCase());
    if (username) {
      query = query.eq("owner.username", username);
    }
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("OG collection query failed", error);
    return new Response("Collection not found", { status: 404 });
  }

  if (!data || !data.is_public) {
    return new Response("Collection not found", { status: 404 });
  }

  const items = (data.collection_items ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .slice(0, 4);

  const tmdbIds = items.map((item) => item.tmdb_id);
  const posters: string[] = [];

  if (tmdbIds.length) {
    const { data: movies } = await service
      .from("movies")
      .select("tmdb_id, poster_url")
      .in("tmdb_id", tmdbIds);
    const posterMap = new Map((movies ?? []).map((movie) => [movie.tmdb_id, movie.poster_url ?? null]));
    for (const id of tmdbIds) {
      const url = posterMap.get(id);
      if (typeof url === "string" && url) {
        posters.push(url);
      }
    }
  }

  const ownerName = data.owner?.display_name ?? data.owner?.username ?? "FrameVault";
  const description = data.description ?? "A FrameVault collection";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "radial-gradient(circle at 20% 20%, #1E1B4B, #030712)",
          color: "white",
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <span style={{ fontSize: 28, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(199, 210, 254, 0.85)" }}>
            {ownerName} • FrameVault
          </span>
          <h1 style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{data.title}</h1>
          <p style={{ fontSize: 32, color: "rgba(226,232,240,0.8)", maxWidth: "72%" }}>{description}</p>
        </div>
        <div style={{ display: "flex", gap: "24px", alignSelf: "flex-end" }}>
          {posters.slice(0, 3).map((poster, index) => (
            <img
              key={poster + index}
              src={poster}
              alt="Poster"
              style={{
                width: 180,
                height: 260,
                borderRadius: 32,
                objectFit: "cover",
                boxShadow: "0 20px 60px rgba(15,23,42,0.45)",
              }}
            />
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
