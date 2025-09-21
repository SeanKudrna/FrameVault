import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ invalid_type_error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" })
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ invalid_type_error: "SUPABASE_SERVICE_ROLE_KEY is required" })
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  TMDB_V4_READ_TOKEN: z
    .string({ invalid_type_error: "TMDB_V4_READ_TOKEN is required" })
    .min(1, "TMDB_V4_READ_TOKEN is required"),
  TMDB_API_KEY: z.string().optional(),
  TMDB_API_BASE: z.string().url().default("https://api.themoviedb.org/3"),
  TMDB_IMAGE_BASE: z.string().url().default("https://image.tmdb.org/t/p"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

const clientSchema = serverSchema.pick({
  NEXT_PUBLIC_SITE_URL: true,
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: true,
  TMDB_API_BASE: true,
  TMDB_IMAGE_BASE: true,
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

let serverEnvCache: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment variables.\n${issues}`);
  }
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

export function getClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    TMDB_API_BASE: process.env.TMDB_API_BASE,
    TMDB_IMAGE_BASE: process.env.TMDB_IMAGE_BASE,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid public environment variables.\n${issues}`);
  }
  return parsed.data;
}
