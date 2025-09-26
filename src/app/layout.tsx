/**
 * Root Next.js layout responsible for wiring fonts, global providers, and
 * bootstrapping authenticated context for every page.
 */

import type { Metadata } from "next";
import type { Session } from "@supabase/supabase-js";
import { Inter, Playfair_Display } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { ensureProfile } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import "./globals.css";

/**
 * Primary sans-serif font used throughout the app.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Serif font used for display headings.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

/**
 * Default metadata applied to every page unless overridden.
 */
export const metadata: Metadata = {
  title: {
    template: "%s | FrameVault",
    default: "FrameVault — Curate cinematic worlds",
  },
  description:
    "FrameVault helps movie lovers build and share cinematic collections with curated notes and TMDB-powered metadata.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: {
    title: "FrameVault",
    description:
      "Curate cinematic collections, discover films, and share your taste with the world.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FrameVault",
    description: "Curate cinematic collections, discover films, and share your taste.",
  },
};

/**
 * Wraps every page with global fonts and providers, ensuring Supabase sessions are available.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await getSupabaseServerClient();
  const [userResponse, sessionResponse] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const rawSession = sessionResponse.data.session ?? null;
  const user = userResponse.data?.user ?? null;
  const session: Session | null = rawSession && user ? { ...rawSession, user } : null;

  let profile: Profile | null = null;
  if (user) {
    // Server components render during navigation and initial page loads, so we
    // resolve the profile here and fall back to automatically creating one when
    // a new account signs in for the first time.
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      profile = data as Profile;
    } else {
      profile = await ensureProfile(user.id, user.email ?? null);
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("bg-background text-foreground antialiased", inter.variable, playfair.variable)}>
        <AppProviders initialSession={session} initialProfile={profile}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
