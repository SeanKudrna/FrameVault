import type { MetadataRoute } from "next";
import { getServerEnv } from "@/env";

export default function robots(): MetadataRoute.Robots {
  const { NEXT_PUBLIC_SITE_URL } = getServerEnv();
  const baseUrl = NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
