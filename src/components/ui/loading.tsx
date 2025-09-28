"use client";

/**
 * Sophisticated loading states and skeleton screens for enhanced perceived performance.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Modern loading spinner with gradient animation.
 */
interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const Spinner = ({ size = "md", className }: SpinnerProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12"
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-tertiary animate-spin opacity-75" />
      <div className="absolute inset-1 rounded-full bg-background" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary animate-pulse" />
    </div>
  );
};

/**
 * Pulsing dots loading animation.
 */
export const DotsLoader = ({ className }: { className?: string }) => (
  <div className={cn("flex space-x-1", className)}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 bg-accent-primary rounded-full animate-pulse"
        style={{
          animationDelay: `${i * 0.2}s`,
          animationDuration: "1.5s"
        }}
      />
    ))}
  </div>
);

/**
 * Skeleton loading component for content placeholders.
 */
interface SkeletonProps {
  className?: string;
  variant?: "default" | "card" | "text" | "avatar";
}

export const Skeleton = ({ className, variant = "default" }: SkeletonProps) => {
  const baseClasses = "animate-pulse bg-gradient-to-r from-surface-secondary via-surface-primary to-surface-secondary bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]";

  const variants = {
    default: "rounded-lg h-4",
    card: "rounded-2xl h-32",
    text: "rounded h-4",
    avatar: "rounded-full h-10 w-10"
  };

  return (
    <div className={cn(baseClasses, variants[variant], className)} />
  );
};

/**
 * Skeleton for collection cards.
 */
export const CollectionCardSkeleton = () => (
  <div className="glass-card p-6 rounded-3xl border border-border-primary">
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" className="h-6 w-3/4" />
          <Skeleton variant="text" className="h-4 w-1/2" />
          <Skeleton variant="text" className="h-4 w-2/3" />
        </div>
        <Skeleton variant="avatar" className="w-8 h-8" />
      </div>

      <div className="flex items-center gap-4">
        <Skeleton variant="text" className="h-3 w-16" />
        <Skeleton variant="text" className="h-3 w-16" />
        <Skeleton variant="text" className="h-3 w-16" />
      </div>

      <div className="pt-4 border-t border-border-secondary">
        <Skeleton variant="text" className="h-3 w-24" />
      </div>
    </div>
  </div>
);

/**
 * Skeleton for dashboard layout.
 */
export const DashboardSkeleton = () => (
  <div className="space-y-12">
    {/* Smart Picks Skeleton */}
    <div className="glass-card p-8 rounded-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton variant="avatar" className="w-8 h-8" />
        <Skeleton variant="text" className="h-6 w-48" />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass p-6 rounded-2xl">
            <div className="space-y-3">
              <Skeleton variant="text" className="h-5 w-3/4" />
              <Skeleton variant="text" className="h-4 w-full" />
              <Skeleton variant="text" className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Collections Header Skeleton */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" className="w-8 h-8" />
          <Skeleton variant="text" className="h-8 w-64" />
        </div>
        <div className="flex items-center gap-6">
          <Skeleton variant="text" className="h-4 w-20" />
          <Skeleton variant="text" className="h-4 w-24" />
          <Skeleton variant="text" className="h-4 w-16" />
        </div>
      </div>
      <Skeleton variant="default" className="h-12 w-40 rounded-xl" />
    </div>

    {/* Collections Grid Skeleton */}
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <CollectionCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

/**
 * Full page loading overlay with backdrop blur.
 */
interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export const LoadingOverlay = ({ message = "Loading...", className }: LoadingOverlayProps) => (
  <div className={cn(
    "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
    className
  )}>
    <div className="text-center space-y-4">
      <Spinner size="lg" />
      <p className="text-text-secondary font-medium">{message}</p>
    </div>
  </div>
);

/**
 * Inline loading state for buttons and small areas.
 */
interface InlineLoaderProps {
  size?: "sm" | "md";
  className?: string;
}

export const InlineLoader = ({ size = "sm", className }: InlineLoaderProps) => (
  <div className={cn("flex items-center gap-2", className)}>
    <Spinner size={size} />
    <span className="text-sm text-text-secondary">Loading...</span>
  </div>
);
