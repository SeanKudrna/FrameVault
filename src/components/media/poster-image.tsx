"use client";

/**
 * Poster image component with resilient fallbacks. Handles TMDB outages by
 * cycling through alternate sizes, service refresh calls, and local placeholders.
 */

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Local placeholder displayed when TMDB assets are unavailable.
 */
const FALLBACK_POSTER = "/images/poster-placeholder.svg";

/**
 * Props for the smart poster image component.
 */
interface PosterImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  tmdbId?: number | null;
  imageClassName?: string;
}

/**
 * Intelligent poster image that handles TMDB fallbacks, alternate sizes, and cache refreshes.
 */
export function PosterImage({
  src,
  fallbackSrc = null,
  alt,
  className,
  sizes = "100vw",
  tmdbId,
  imageClassName,
}: PosterImageProps) {
  const initial = src ?? fallbackSrc ?? null;
  const [posterSrc, setPosterSrc] = useState<string | null>(initial);
  const [failed, setFailed] = useState(false);
  const [hasRefetched, setHasRefetched] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [sizeIndex, setSizeIndex] = useState(0);

  // Predefined TMDB image widths to fall back through when a particular size is
  // missing from the CDN cache.
  const tmdbSizeCandidates = useMemo(() => ["w500", "w780", "original"], []);

  useEffect(() => {
    setPosterSrc(src ?? fallbackSrc ?? null);
    setFailed(false);
    setHasRefetched(false);
    setSizeIndex(0);
  }, [src, fallbackSrc, tmdbId]);

  const refetchPoster = useCallback(async () => {
    if (!tmdbId || hasRefetched || isFetching) {
      setFailed(true);
      return;
    }

    try {
      setIsFetching(true);
      const response = await fetch(`/api/tmdb/movie?id=${tmdbId}&refresh=1`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const data = (await response.json()) as { movie?: { posterUrl?: string | null; fallbackPosterUrl?: string | null } };
      const nextPoster = data.movie?.posterUrl ?? data.movie?.fallbackPosterUrl ?? null;
      if (nextPoster) {
        setPosterSrc(nextPoster);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch (error) {
      console.warn("Unable to refetch TMDB poster", error);
      setFailed(true);
    } finally {
      setHasRefetched(true);
      setIsFetching(false);
      setSizeIndex(0);
    }
  }, [tmdbId, hasRefetched, isFetching]);

  useEffect(() => {
    if (!posterSrc && (fallbackSrc || tmdbId) && !hasRefetched && !isFetching) {
      if (fallbackSrc) {
        setPosterSrc(fallbackSrc);
        setFailed(false);
        setHasRefetched(true);
        return;
      }
      void refetchPoster();
    }
  }, [posterSrc, fallbackSrc, tmdbId, hasRefetched, isFetching, refetchPoster]);

  const resolvedSrc = failed || !posterSrc ? FALLBACK_POSTER : posterSrc;

  /**
   * Attempts to derive the next available TMDB poster size when the current one fails.
   */
  function nextTmdbSize(currentUrl: string) {
    const match = currentUrl.match(/\/t\/p\/(w\d+|original)\//);
    if (!match) return null;
    const currentSize = match[1];
    const currentIdx = tmdbSizeCandidates.indexOf(currentSize);
    const nextIdx = currentIdx === -1 ? sizeIndex + 1 : currentIdx + 1;
    if (nextIdx >= tmdbSizeCandidates.length) return null;
    setSizeIndex(nextIdx);
    return currentUrl.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${tmdbSizeCandidates[nextIdx]}/`);
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={cn("object-cover", imageClassName)}
        onError={() => {
          if (fallbackSrc && posterSrc !== fallbackSrc) {
            setPosterSrc(fallbackSrc);
            setFailed(false);
            setHasRefetched(true);
            setSizeIndex(0);
            return;
          }
          if (posterSrc && posterSrc.includes("image.tmdb.org")) {
            const next = nextTmdbSize(posterSrc);
            if (next && next !== posterSrc) {
              setPosterSrc(next);
              setFailed(false);
              return;
            }
          }
          if (resolvedSrc === FALLBACK_POSTER) return;
          void refetchPoster();
        }}
        priority={false}
      />
    </div>
  );
}
