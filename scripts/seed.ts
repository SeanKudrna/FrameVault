import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/env";
import type { Database } from "@/lib/supabase/types";
import { slugify } from "@/lib/slugs";

async function main() {
  const env = getServerEnv();
  const supabase = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const admin = supabase.auth.admin;
  const email = "demo@framevault.dev";
  const password = "FrameVault!2024";
  const displayName = "Avery Demo";

  let userId: string | null = null;
  const userLookup = await admin.listUsers({ page: 1, perPage: 1, email });
  if (userLookup.error) {
    throw userLookup.error;
  }
  const existingUser = userLookup.data.users?.find((user) =>
    user.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const created = await admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
      },
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Failed to create seed user");
    }
    userId = created.data.user.id;
  }

  if (!userId) throw new Error("User id missing after seed");

  const username = slugify(displayName);
  const profile = await supabase
    .from("profiles")
    .upsert(
      { id: userId, username, display_name: displayName, plan: "free" },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (profile.error) {
    throw profile.error;
  }

  const movies = [
    {
      tmdb_id: 272,
      title: "Batman Begins",
      release_year: 2005,
      poster_url: "/8RW2runSEc34IwKN2D1aPcJd2UL.jpg",
      backdrop_url: "/vfX5foR8qasLCzsxL61KOIV1GSf.jpg",
      genres: [{ id: 28, name: "Action" }, { id: 80, name: "Crime" }],
      runtime: 140,
    },
    {
      tmdb_id: 49026,
      title: "The Dark Knight Rises",
      release_year: 2012,
      poster_url: "/hr0L2aueqlP2BYUblTTjmtn0hw4.jpg",
      backdrop_url: "/3bgtUfKQKNi3nJsAB5URpP2wdRt.jpg",
      genres: [{ id: 28, name: "Action" }, { id: 80, name: "Crime" }],
      runtime: 164,
    },
    {
      tmdb_id: 155,
      title: "The Dark Knight",
      release_year: 2008,
      poster_url: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      backdrop_url: "/9myrRcegWGGp24mpVfkD4zhUfhi.jpg",
      genres: [{ id: 28, name: "Action" }, { id: 80, name: "Crime" }],
      runtime: 152,
    },
    {
      tmdb_id: 603,
      title: "The Matrix",
      release_year: 1999,
      poster_url: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      backdrop_url: "/9TGHDvWrqKBzwDxDodHYXEmOE6J.jpg",
      genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }],
      runtime: 136,
    },
    {
      tmdb_id: 604,
      title: "The Matrix Reloaded",
      release_year: 2003,
      poster_url: "/9TGaoz6fvmVrGLNQJPTp0kIAZVG.jpg",
      backdrop_url: "/7u3pxc0K1wx32IleAkLv78MKgrw.jpg",
      genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }],
      runtime: 138,
    },
    {
      tmdb_id: 605,
      title: "The Matrix Revolutions",
      release_year: 2003,
      poster_url: "/pdVDHj6RzsXZW1wrFMxH8g0s0Kx.jpg",
      backdrop_url: "/u8dV1QvLl0MTRPMbn5wloY3gxZX.jpg",
      genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }],
      runtime: 129,
    },
    {
      tmdb_id: 150,
      title: "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe",
      release_year: 2005,
      poster_url: "/iREd0rNCjYdf5Ar0vfaW32yrkm.jpg",
      backdrop_url: "/g1rK2nRXSidcMwNliWDIroWWGTn.jpg",
      genres: [{ id: 12, name: "Adventure" }, { id: 14, name: "Fantasy" }],
      runtime: 143,
    },
    {
      tmdb_id: 467938,
      title: "The Call of the Wild",
      release_year: 2020,
      poster_url: "/33VdppGbeNxICrFUtW2WpGHvfYc.jpg",
      backdrop_url: "/wzJRB4MKi3yK138bJyuL9nx47y6.jpg",
      genres: [{ id: 12, name: "Adventure" }, { id: 18, name: "Drama" }],
      runtime: 100,
    },
    {
      tmdb_id: 508442,
      title: "Soul",
      release_year: 2020,
      poster_url: "/hm58Jw4Lw8OIeECIq5qyPYhAeRJ.jpg",
      backdrop_url: "/kf456ZqeC45XTvo6W9pW5clYKfQ.jpg",
      genres: [{ id: 16, name: "Animation" }, { id: 35, name: "Comedy" }],
      runtime: 100,
    },
    {
      tmdb_id: 337404,
      title: "Cruella",
      release_year: 2021,
      poster_url: "/rTh4K5uw9HypmpGslcKd4QfHl93.jpg",
      backdrop_url: "/qHZ1J1k5qFZlYVC7yBMn1bVxGgi.jpg",
      genres: [{ id: 35, name: "Comedy" }, { id: 80, name: "Crime" }],
      runtime: 134,
    },
    {
      tmdb_id: 508943,
      title: "Luca",
      release_year: 2021,
      poster_url: "/jTswp6KyDYKtvC52GbHagrZbGvD.jpg",
      backdrop_url: "/620hnMVLu6RSZW6a5rwO8gqpt0t.jpg",
      genres: [{ id: 16, name: "Animation" }, { id: 12, name: "Adventure" }],
      runtime: 96,
    },
    {
      tmdb_id: 8587,
      title: "The Lion King",
      release_year: 1994,
      poster_url: "/sKCr78iBBS7WT87WvoYULYpMj2c.jpg",
      backdrop_url: "/eIOTsGg9FCVrBc4r2nXaV61JF4F.jpg",
      genres: [{ id: 16, name: "Animation" }, { id: 18, name: "Drama" }],
      runtime: 89,
    },
  ];

  const upsertMovies = await supabase.from("movies").upsert(
    movies.map((movie) => ({
      ...movie,
      poster_url: movie.poster_url ? `${env.TMDB_IMAGE_BASE}/w500${movie.poster_url}` : null,
      backdrop_url: movie.backdrop_url ? `${env.TMDB_IMAGE_BASE}/w1280${movie.backdrop_url}` : null,
      tmdb_json: null,
    })),
    { onConflict: "tmdb_id" }
  );

  if (upsertMovies.error) {
    throw upsertMovies.error;
  }

  const collections = [
    {
      title: "Midnight Vigilantes",
      is_public: true,
      description: "A curated run of neo-noir tales where justice gets personal.",
      movieIds: [272, 155, 49026, 603, 604, 605],
    },
    {
      title: "Comfort Reels",
      is_public: true,
      description: "Feel-good adventures for cozy nights in.",
      movieIds: [150, 467938, 508442, 337404, 508943, 8587],
    },
  ];

  for (const [index, collection] of collections.entries()) {
    const slug = `${slugify(collection.title)}-${index + 1}`;
    const inserted = await supabase
      .from("collections")
      .upsert(
        {
          owner_id: userId,
          title: collection.title,
          slug,
          description: collection.description,
          is_public: collection.is_public,
        },
        { onConflict: "owner_id,slug" }
      )
      .select("id")
      .single();

    if (inserted.error || !inserted.data) {
      throw inserted.error ?? new Error("Failed to insert collection");
    }

    const collectionId = inserted.data.id;

    const items = collection.movieIds.map((tmdb_id, position) => ({
      collection_id: collectionId,
      tmdb_id,
      position,
    }));

    const upsertItems = await supabase
      .from("collection_items")
      .upsert(items, { onConflict: "collection_id,tmdb_id" });

    if (upsertItems.error) throw upsertItems.error;
  }

  console.log("Seed data ready. Sign in with:");
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
