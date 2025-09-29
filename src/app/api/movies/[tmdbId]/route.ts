import { notFound } from "next/navigation";
import { getMovieDetail, resolveGenreName } from "@/lib/tmdb";
import { fetchWatchProviders } from "@/lib/tmdb";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSmartPicksForUser } from "@/lib/recommendations";

function formatRuntime(runtime: number | null) {
  if (!runtime || runtime <= 0) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId: tmdbIdParam } = await params;
    const tmdbId = Number(tmdbIdParam);
    if (!Number.isFinite(tmdbId)) {
      notFound();
    }

    const movie = await getMovieDetail(tmdbId);
    if (!movie) {
      notFound();
    }

    const supabase = await getSupabaseServerClient();
    const [{ data: userData }] = await Promise.all([
      supabase.auth.getUser().catch((error) => {
        // Handle auth session missing errors gracefully
        if (error?.message?.includes('Auth session missing')) {
          return { data: { user: null }, error: null };
        }
        throw error;
      }),
    ]);
    const user = userData?.user;
    if (!user) {
      notFound();
    }

    const { data: collectionsData, error: collectionsError } = await supabase
      .from("collections")
      .select("id, title, slug")
      .eq("owner_id", user.id as string)
      .order("created_at", { ascending: true });
    if (collectionsError) {
      throw collectionsError;
    }
    const collections = (collectionsData ?? []).map((collection) => ({
      id: collection.id,
      title: collection.title,
    }));

        const providers = await fetchWatchProviders(tmdbId).catch((error) => {
          console.error("Error fetching watch providers:", error);
          return null;
        });
    const cast = movie.cast.slice(0, 12);
    const crew = movie.crew;
    const directors = crew.filter((member) => member.job?.toLowerCase() === "director");
    const writers = crew.filter((member) => member.job && member.job.toLowerCase().includes("writer"));
    const cinematographers = crew.filter((member) =>
      member.job && (member.job.toLowerCase().includes("cinematographer") ||
                     member.job.toLowerCase().includes("director of photography") ||
                     member.job.toLowerCase().includes("dop"))
    );
    const producers = crew.filter((member) =>
      member.job && member.job.toLowerCase().includes("producer")
    );
    const editors = crew.filter((member) => member.job?.toLowerCase() === "editor");
    const productionDesigners = crew.filter((member) =>
      member.job && member.job.toLowerCase().includes("production designer")
    );
    const composers = crew.filter((member) =>
      member.job && (member.job.toLowerCase().includes("composer") ||
                     member.job.toLowerCase().includes("music"))
    );
    const tmdbReviews = movie.reviews.slice(0, 20);
    const runtimeFormatted = formatRuntime(movie.runtime);
    const voteAverage = typeof movie.voteAverage === "number" && movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : null;

    // Generate rationale for this movie
    let rationale: string[] = [];
    try {
      const { profile } = await getSmartPicksForUser(user.id, { limit: 1 });

      // Check if any of this movie's genres match the user's top genres
      const overlappingGenres = movie.genres
        .filter((genre) => profile.topGenres.some((topGenre) => topGenre.id === genre.id))
        .map((genre) => ({
          id: genre.id,
          name: resolveGenreName(genre.id, genre.name),
        }));

      if (overlappingGenres.length > 0) {
        rationale = overlappingGenres
          .slice(0, 2)
          .map((genre) => `Because you love ${resolveGenreName(genre.id, genre.name)}`);
      } else if (profile.topGenres.length > 0) {
        const primary = profile.topGenres[0];
        rationale = [`Because you're into ${resolveGenreName(primary.id, primary.name)}`];
      } else {
        rationale = ["Trending with the FrameVault community"];
      }
    } catch (error) {
      // Fallback rationale if we can't get taste profile
      rationale = ["Trending with the FrameVault community"];
    }

    return Response.json({
      movie,
      collections,
      providers,
      cast,
      crew,
      directors,
      writers,
      cinematographers,
      producers,
      editors,
      productionDesigners,
      composers,
      tmdbReviews,
      runtimeFormatted,
      voteAverage,
      rationale,
    });
  } catch (error) {
    console.error("Error fetching movie data:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
