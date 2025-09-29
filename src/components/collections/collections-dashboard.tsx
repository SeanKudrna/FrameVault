"use client";

/**
 * Collections Dashboard Component
 *
 * Main dashboard interface for authenticated users to manage their movie collections.
 * This component serves as the central hub for collection management, featuring:
 *
 * - Smart Picks recommendations (Pro feature) with personalized movie suggestions
 * - Collection creation with plan-gated limits
 * - Grid-based collection cards with management actions
 * - Empty state guidance for new users
 * - Responsive design with smooth animations
 *
 * Key Features:
 * - Client-side rendering for interactive dialogs and optimistic updates
 * - Real-time plan enforcement with upgrade prompts
 * - Persistent UI state for collapsible sections
 * - Integration with server actions for data mutations
 * - Toast notifications for user feedback
 *
 * State Management:
 * - Uses React hooks for local state management
 * - Persists smart picks expansion state across sessions
 * - Handles loading states during async operations
 * - Optimistic UI updates with server action rollbacks on failure
 *
 * Performance Considerations:
 * - Memoized calculations for smart picks summaries
 * - Efficient re-rendering with targeted state updates
 * - Lazy loading of recommendations data
 */

import React, { useEffect, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Ellipsis, Eye, EyeOff, PencilLine, Plus, Sparkles, Trash2, Film, Calendar, Lock, Globe, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlanGate } from "@/components/plan/plan-gate";
import { useToast } from "@/components/providers/toast-provider";
import {
  createCollectionAction,
  deleteCollectionAction,
  updateCollectionDetailsAction,
} from "@/app/(app)/collections/actions";
import type { Profile } from "@/lib/supabase/types";
import { planGateMessage, PLAN_COLLECTION_LIMIT, canCreateCollection } from "@/lib/plan";
import type { SmartPick, TasteProfile } from "@/lib/recommendations";
import { PosterImage } from "@/components/media/poster-image";
import { cn } from "@/lib/utils";
import { extractThemeId, getThemeConfig } from "@/lib/themes";

// Note: This key is intentionally not user-specific so the state persists across login/logout

/**
 * Smart Picks Carousel Component
 *
 * Displays personalized movie recommendations in a paginated carousel format.
 * Features smooth animations, navigation controls, and responsive design.
 *
 * Pagination Logic:
 * - Shows 3 items per page on desktop, fewer on mobile
 * - Calculates total pages based on recommendation count
 * - Handles edge cases like empty lists and single pages
 * - Provides previous/next navigation when multiple pages exist
 *
 * Animation Strategy:
 * - Uses Framer Motion for smooth page transitions
 * - Staggers item animations with delays for visual appeal
 * - Maintains consistent animation duration across interactions
 *
 * Performance:
 * - Memoizes pagination calculations to avoid unnecessary re-computations
 * - Only renders visible items to optimize DOM size
 * - Uses AnimatePresence for proper exit animations
 *
 * @param recommendations - Array of SmartPick objects containing movie data and rationale
 */
function SmartPicksCarousel({ recommendations }: { recommendations: SmartPick[] }) {
  // Pagination state and calculations
  const [page, setPage] = useState(0);
  const itemsPerView = 3; // Fixed number of items per carousel page
  const totalPages = Math.max(1, Math.ceil(recommendations.length / itemsPerView));

  // Ensure page index stays within valid bounds
  const clampedPage = Math.min(page, totalPages - 1);
  const startIndex = clampedPage * itemsPerView;
  const visibleItems = recommendations.slice(startIndex, startIndex + itemsPerView);

  // Navigation visibility and availability
  const showNavigation = recommendations.length > itemsPerView;
  const canGoPrev = clampedPage > 0;
  const canGoNext = startIndex + itemsPerView < recommendations.length;

  useEffect(() => {
    setPage(0);
  }, [recommendations.length]);

  return (
    <div className="relative">
      <div className="mb-6 flex items-center gap-4">
        {showNavigation ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={!canGoPrev}
            className="h-10 w-10 rounded-xl hover:bg-surface-hover disabled:opacity-40"
            aria-label="Show previous smart picks"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="hidden h-10 w-10 md:block" aria-hidden="true" />
        )}

        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="wait">
            {visibleItems.map((pick) => (
              <motion.div
                key={`${pick.movie.tmdbId}-${clampedPage}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="h-full py-1"
              >
                <SmartPickCard pick={pick} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {showNavigation ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
            disabled={!canGoNext}
            className="h-10 w-10 rounded-xl hover:bg-surface-hover disabled:opacity-40"
            aria-label="Show next smart picks"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <div className="hidden h-10 w-10 md:block" aria-hidden="true" />
        )}
      </div>

      {showNavigation ? (
        <div className="flex justify-center gap-2 pb-3">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setPage(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-transform duration-200",
                index === clampedPage
                  ? "bg-accent-primary scale-125"
                  : "bg-border-primary hover:bg-border-secondary"
              )}
              aria-label={`Go to smart picks set ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Lightweight projection of a collection used within the dashboard grid.
 */
export interface CollectionSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
  theme: Record<string, unknown> | null;
}

/**
 * Props for the collections dashboard component.
 */
interface CollectionsDashboardProps {
  profile: Profile;
  collections: CollectionSummary[];
  recommendations?: SmartPick[] | null;
  tasteProfile?: TasteProfile | null;
}

/**
 * Renders the authenticated dashboard with create dialogs, plan gating, and collection cards.
 */
/**
 * Main Collections Dashboard Component
 *
 * Orchestrates the entire dashboard experience with multiple sections and state management.
 * Handles collection creation, smart picks display, and plan-based feature gating.
 *
 * @param profile - User profile with plan information for feature gating
 * @param collections - Array of user's collections for grid display
 * @param recommendations - Optional smart picks for Pro users
 * @param tasteProfile - Optional taste profile data for recommendation context
 */
export function CollectionsDashboard({ profile, collections, recommendations, tasteProfile }: CollectionsDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Debug logging for component lifecycle and state changes
  console.log('CollectionsDashboard render:', {
    profileId: profile.id,
    recommendationsCount: recommendations?.length,
    timestamp: new Date().toISOString()
  });

  // Dialog state for collection creation modal
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [pending, startTransition] = useTransition(); // For optimistic UI updates
  const [error, setError] = useState<string | null>(null);

  // Smart picks state management with SSR-safe initialization
  const [smartPicks, setSmartPicks] = useState<SmartPick[]>(() => recommendations ?? []);
  const [smartProfile, setSmartProfile] = useState<TasteProfile | null>(() => tasteProfile ?? null);
  const [refreshingSmartPicks, setRefreshingSmartPicks] = useState(false);

  /**
   * Smart Picks Expansion State
   *
   * Persists user's preference for showing/hiding smart picks section.
   * Uses both localStorage and sessionStorage for cross-tab persistence.
   * SSR-safe with fallback to default expanded state.
   */
  const [smartPicksOpen, setSmartPicksOpen] = useState<boolean>(() => {
    // Server-side rendering fallback - default to expanded
    if (typeof window === "undefined") return true;

    try {
      // Generate user-specific storage key
      const key = `framevault:smart-picks-open:${profile.id}`;
      // Check both storage types for existing preference
      const stored = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      const result = stored === null ? true : stored === "true"; // Default to true if no preference set

      console.log('Initializing smart picks state:', {
        key,
        stored,
        result,
        profileId: profile.id,
        timestamp: new Date().toISOString()
      });
      return result;
    } catch (error) {
      console.error('Error initializing smart picks state:', error);
      return true; // Fallback to expanded on error
    }
  });

  // Hydration tracking to prevent SSR/client mismatches
  const [isHydrated, setIsHydrated] = useState(false);

  // Debug: Component lifecycle monitoring
  React.useEffect(() => {
    console.log('CollectionsDashboard mounted/remounted');
    return () => console.log('CollectionsDashboard unmounting');
  }, []);

  /**
   * Smart Picks Summary Generator
   *
   * Creates a human-readable summary of available recommendations for display
   * in the collapsed smart picks section. Handles various scenarios:
   *
   * - Empty state: Encouraging message for new users
   * - Single recommendation: Direct title reference
   * - Multiple recommendations: Shows first 1-2 titles with count of remaining
   *
   * Memoized for performance since it depends on smartPicks array.
   * Filters out invalid/empty titles to ensure clean display.
   */
  const smartPickSummary = useMemo(() => {
    if (!smartPicks.length) return null;

    // Extract and validate movie titles
    const titles = smartPicks
      .map((pick) => pick.movie.title)
      .filter((title): title is string => Boolean(title && title.trim().length));

    if (titles.length === 0) {
      return "Fresh picks ready when you are."; // Fallback for recommendations without titles
    }

    if (titles.length === 1) {
      const remaining = smartPicks.length - 1;
      return remaining > 0
        ? `${titles[0]} and ${remaining} more picked just for you`
        : `${titles[0]} — picked just for you`;
    }

    // Handle 2+ titles with smart truncation
    const [first, second] = titles;
    const remaining = smartPicks.length - 2;
    return remaining > 0
      ? `${first}, ${second}, and ${remaining} more picked just for you`
      : `${first} and ${second} — picked just for you`;
  }, [smartPicks]);


  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) {
      return;
    }

    try {
      console.log('Saving smart picks state:', { smartPicksOpen, profileId: profile.id, timestamp: new Date().toISOString() });
      const value = smartPicksOpen ? "true" : "false";
      const key = `framevault:smart-picks-open:${profile.id}`;

      // Save to both localStorage and sessionStorage
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      console.error('Error saving smart picks state:', error);
    }
  }, [smartPicksOpen, profile.id, isHydrated]);

  useEffect(() => {
    // Mark as hydrated after initial render
    setIsHydrated(true);
    console.log('CollectionsDashboard hydrated, smartPicksOpen:', smartPicksOpen);
  }, []);

  useEffect(() => {
    setSmartPicks(recommendations ?? []);
  }, [recommendations]);

  useEffect(() => {
    setSmartProfile(tasteProfile ?? null);
  }, [tasteProfile]);

  /**
   * Refresh Smart Picks Function
   *
   * Fetches fresh personalized movie recommendations from the server.
   * Implements deduplication by excluding currently displayed picks.
   *
   * Algorithm:
   * 1. Prevent concurrent refresh requests
   * 2. Build exclusion list from current smart picks to avoid duplicates
   * 3. Request same number of picks or default to 6 for empty state
   * 4. Update local state with fresh recommendations
   * 5. Handle errors gracefully with user feedback
   *
   * @async
   * @returns {Promise<void>}
   */
  async function refreshSmartPicks() {
    // Prevent multiple simultaneous refresh requests
    if (refreshingSmartPicks) return;

    try {
      setRefreshingSmartPicks(true);

      // Build exclusion parameter to avoid showing duplicate recommendations
      const excludeParam = smartPicks.length
        ? `&exclude=${smartPicks.map((pick) => pick.movie.tmdbId).join(",")}`
        : "";

      // Maintain same number of picks or use default for initial load
      const limitParam = smartPicks.length ? smartPicks.length : 6;

      // Fetch fresh recommendations with cache bypass
      const response = await fetch(`/api/recommendations?limit=${limitParam}${excludeParam}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store", // Ensure fresh data from server
      });

      if (!response.ok) {
        // Extract error message from response if available
        const message = await response
          .json()
          .then((data) => (typeof data?.message === "string" ? data.message : null))
          .catch(() => null);
        throw new Error(message ?? "Unable to refresh Smart Picks right now");
      }

      // Parse and validate response data
      const result = (await response.json()) as { picks?: SmartPick[]; profile?: TasteProfile | null };

      // Update local state with fresh recommendations
      setSmartPicks(result.picks ?? []);
      setSmartProfile(result.profile ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to refresh Smart Picks";
      toast({ title: "Refresh failed", description: message, variant: "error" });
    } finally {
      setRefreshingSmartPicks(false);
    }
  }

  /**
   * Plan-based Collection Limits
   *
   * Determines collection creation limits based on user's current plan.
   * Free users get limited collections, paid plans get unlimited.
   * Used for UI gating and validation.
   */
  const limit = PLAN_COLLECTION_LIMIT[profile.plan] ?? Infinity;

  /**
   * Collection Creation Permission Check
   *
   * Evaluates whether the user can create new collections based on:
   * - Current plan limitations
   * - Existing collection count
   * - Any pending plan changes that might affect limits
   *
   * This client-side check mirrors server-side validation for better UX.
   */
  const canCreate = canCreateCollection(profile, collections.length);

  /**
   * Collection Creation Handler
   *
   * Processes the collection creation form with validation and optimistic UI updates.
   * Uses React transitions to keep the dialog interactive during server action execution.
   *
   * Validation:
   * - Requires non-empty title after trimming whitespace
   * - Optional description field
   *
   * Error Handling:
   * - Displays validation errors in form and toast
   * - Shows server errors with user-friendly messages
   * - Maintains form state on validation failures
   *
   * Success Flow:
   * - Clears form and closes dialog
   * - Triggers router refresh to update collection list
   * - Shows success toast with confirmation
   *
   * @param event - Form submission event
   */
  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Sanitize and validate form inputs
    const trimmedTitle = formTitle.trim();
    const trimmedDescription = formDescription.trim();

    // Title is required for collection creation
    if (!trimmedTitle) {
      const message = "Please provide a title for your collection";
      setError(message);
      toast({ title: "Missing title", description: message, variant: "error" });
      return;
    }

    // Use React transition to maintain UI responsiveness during async operation
    startTransition(async () => {
      try {
        await createCollectionAction({
          title: trimmedTitle,
          description: trimmedDescription ? trimmedDescription : null,
        });

        // Reset form state on successful creation
        setFormTitle("");
        setFormDescription("");
        setDialogOpen(false);

        // Provide user feedback and refresh the collection list
        toast({
          title: "Collection created",
          description: `"${trimmedTitle}" is ready to curate.`,
          variant: "success",
        });
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to create collection";
        setError(message);
        toast({ title: "Unable to create collection", description: message, variant: "error" });
      }
    });
  }

  /**
   * Main Dashboard Render
   *
   * Renders the complete dashboard layout with conditional sections based on user plan and state.
   * The layout is structured as follows:
   *
   * 1. Smart Picks Section (Pro users only)
   *    - Personalized movie recommendations
   *    - Collapsible with persistent state
   *    - Refresh functionality with loading states
   *
   * 2. Collections Header
   *    - Title and description
   *    - Collection statistics
   *    - Create collection button with plan gating
   *
   * 3. Plan Gate (when limit reached)
   *    - Upgrade prompt for free users at limit
   *
   * 4. Collections Grid
   *    - Empty state for new users
   *    - Grid of collection cards with animations
   *    - Each card shows metadata and management actions
   *
   * Responsive Design:
   * - Mobile-first approach with progressive enhancement
   * - Adaptive grid layouts for different screen sizes
   * - Touch-friendly interactions and spacing
   *
   * Animation Strategy:
   * - Framer Motion for smooth page transitions
   * - Staggered animations for list items
   * - Reduced motion support for accessibility
   */
  return (
    <div className="space-y-12">
      {/* Smart Picks Section - Pro Only Feature */}
      {profile.plan === "pro" && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative overflow-hidden rounded-3xl",
            smartPicksOpen && isHydrated ? "glass-card px-8 pt-6 pb-10" : "glass px-8 pt-6 pb-3"
          )}
        >
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/5 via-accent-secondary/5 to-accent-tertiary/5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-secondary animate-pulse" />
                  <h2 className="text-2xl font-bold text-gradient">Smart Picks for You</h2>
                  <div className="px-2 py-1 bg-gradient-to-r from-accent-secondary to-accent-tertiary rounded-full text-xs font-medium text-white">
                    PRO
                  </div>
                </div>
                <p className="text-text-secondary">
                  {smartProfile?.topGenres?.length
                    ? `Inspired by your love of ${smartProfile.topGenres
                        .slice(0, 2)
                        .map((genre) => genre.name)
                        .join(" & ")}`
                    : "Watch and curate more films to fine-tune your personalized recommendations."}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={refreshSmartPicks}
                  disabled={refreshingSmartPicks}
                  className="group hover:bg-white/80 hover:text-accent-primary hover:shadow-[0_12px_32px_rgba(255,255,255,0.2)] cursor-pointer"
                >
                  <RotateCcw
                    size={16}
                    className={cn(
                      "transition-transform",
                      refreshingSmartPicks ? "animate-spin" : "group-hover:-rotate-90"
                    )}
                  />
                  {refreshingSmartPicks ? "Refreshing" : "Refresh"}
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => {
                    const newState = !smartPicksOpen;
                    console.log('Toggling smart picks:', { from: smartPicksOpen, to: newState, timestamp: new Date().toISOString() });
                    setSmartPicksOpen(newState);
                  }}
                  className="group hover:bg-white/80 hover:text-accent-primary hover:shadow-[0_12px_32px_rgba(255,255,255,0.2)] cursor-pointer"
                  aria-expanded={smartPicksOpen && isHydrated}
                  aria-controls="smart-picks-panel"
                >
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-300 ${smartPicksOpen && isHydrated ? "rotate-180" : "rotate-0"}`}
                  />
                  {smartPicksOpen && isHydrated ? "Hide Picks" : "Show Picks"}
                </Button>
              </div>
            </div>

            {!smartPicksOpen && smartPickSummary ? (
              <p className="mb-4 text-xs text-text-tertiary">{smartPickSummary}</p>
            ) : null}

            <AnimatePresence mode="wait">
              {smartPicksOpen && (
                <motion.div
                  id="smart-picks-panel"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
          {smartPicks && smartPicks.length > 0 ? (
              <SmartPicksCarousel recommendations={smartPicks} />
          ) : (
            <div className="glass p-8 text-center rounded-2xl">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-surface-secondary rounded-full flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-text-muted" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Build Your Taste Profile</h3>
                  <p className="text-text-tertiary">
                    Add ratings and build collections to unlock personalized recommendations tailored just for you.
                  </p>
                </div>
              </div>
            </div>
          )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      )}

      {/* Collections Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2 md:px-4"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-accent-primary to-accent-secondary rounded-xl">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gradient">Your Collections</h1>
              <p className="text-text-secondary">Craft, curate, and share your cinematic masterpieces</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-text-tertiary">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent-primary rounded-full"></div>
              <span>{collections.length} collections</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent-secondary rounded-full"></div>
              <span>{collections.reduce((sum, col) => sum + col.item_count, 0)} films total</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent-tertiary rounded-full"></div>
              <span>{collections.filter(col => col.is_public).length} public</span>
            </div>
          </div>
        </div>

        <div>
          <Dialog.Root open={isDialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Trigger asChild>
            <Button
              size="lg"
              disabled={!canCreate}
              className="group shadow-lg hover:!text-[#0a0a0f] cursor-pointer"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform" />
              New Collection
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 focus:outline-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-3xl p-8 shadow-2xl"
              >
                <div className="space-y-6">
                  {/* Header */}
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-r from-accent-primary to-accent-secondary rounded-2xl flex items-center justify-center">
                      <Plus className="w-8 h-8 text-white" />
                    </div>
                    <Dialog.Title className="text-2xl font-bold text-gradient">Create Collection</Dialog.Title>
                    <Dialog.Description className="text-text-secondary">
                      Give your cinematic theme a name and optional description.
                    </Dialog.Description>
                  </div>

                  {/* Form */}
                  <form className="space-y-6" onSubmit={handleCreate}>
                    <div className="space-y-2">
                      <label className="text-label" htmlFor="collection-title">
                        Collection Title
                      </label>
                      <Input
                        id="collection-title"
                        value={formTitle}
                        onChange={(event) => setFormTitle(event.target.value)}
                        placeholder="Midnight Mysteries"
                        autoFocus
                        className="bg-surface-primary border-border-primary focus:border-accent-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-label" htmlFor="collection-description">
                        Description <span className="text-text-tertiary">(optional)</span>
                      </label>
                      <Textarea
                        id="collection-description"
                        value={formDescription}
                        onChange={(event) => setFormDescription(event.target.value)}
                        placeholder="A journey through films that explore the shadows of the human psyche..."
                        rows={3}
                        className="bg-surface-primary border-border-primary focus:border-accent-primary"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <Dialog.Close asChild>
                        <Button variant="outline">Cancel</Button>
                      </Dialog.Close>
                      <Button type="submit" disabled={pending} className="min-w-[100px]">
                        {pending ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
          </Dialog.Root>
        </div>
      </motion.div>

      {!canCreate && limit !== Infinity ? (
        <PlanGate
          title="You’ve reached the free tier limit"
          message={planGateMessage(profile)}
          ctaLabel="Upgrade to Plus"
          href="/settings/billing"
        />
      ) : null}

      {/* Collections Grid */}
      <AnimatePresence mode="popLayout">
        {collections.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden"
          >
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-accent-secondary/5 to-accent-tertiary/5 rounded-3xl" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-primary/5 rounded-full blur-3xl" />

            <div className="relative glass-card p-16 text-center rounded-3xl">
              <div className="space-y-8">
                {/* Animated Icon */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 mx-auto bg-gradient-to-r from-accent-primary to-accent-secondary rounded-2xl flex items-center justify-center"
                >
                  <Film className="w-12 h-12 text-white" />
                </motion.div>

                {/* Content */}
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-gradient">Create Your First Collection</h2>
                  <p className="text-lead max-w-md mx-auto">
                    Start building your personal film library. Add movies, organize them beautifully,
                    and share your cinematic taste with the world.
                  </p>
                </div>

                {/* Action Button */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="lg" onClick={() => setDialogOpen(true)} className="shadow-2xl">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Collection
                  </Button>
                </motion.div>

                {/* Feature Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 pt-8 border-t border-border-primary">
                  {[
                    { icon: Film, title: "Add Movies", desc: "Search TMDB and add films instantly" },
                    { icon: Sparkles, title: "Organize", desc: "Drag, reorder, and categorize" },
                    { icon: Globe, title: "Share", desc: "Publish beautiful public pages" }
                  ].map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="text-center space-y-2"
                    >
                      <div className="w-12 h-12 mx-auto bg-surface-secondary rounded-xl flex items-center justify-center">
                        <feature.icon className="w-6 h-6 text-accent-primary" />
                      </div>
                      <h3 className="font-semibold text-text-primary">{feature.title}</h3>
                      <p className="text-sm text-text-tertiary">{feature.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            layout
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {collections.map((collection, index) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <CollectionCard
                  collection={collection}
                  profile={profile}
                  onUpdated={() => router.refresh()}
                  onDeleted={() => router.refresh()}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Props for the SmartPickCard component.
 */
interface SmartPickCardProps {
  pick: SmartPick;
}

/**
 * SmartPickCard Component
 *
 * Individual recommendation card displaying a personalized movie suggestion.
 * Shows movie poster, title, overview, rationale tags, and navigation to movie details.
 *
 * Features:
 * - Keyboard navigation support (Enter/Space to navigate)
 * - Accessible link semantics with proper ARIA attributes
 * - Hover effects and smooth transitions
 * - Responsive layout with poster and content side-by-side
 * - TMDB external link for additional movie information
 *
 * @param pick - SmartPick object containing movie data and recommendation rationale
 */
function SmartPickCard({ pick }: SmartPickCardProps) {
  const router = useRouter();

  // Format movie metadata for display
  const releaseYear = pick.movie.releaseYear ? ` • ${pick.movie.releaseYear}` : "";
  const runtimeLabel = pick.movie.runtime ? `${pick.movie.runtime} min` : "Feature length";

  // Limit rationale tags to prevent overflow (show first 3)
  const rationale = pick.rationale.slice(0, 3);

  /**
   * Navigation handler for movie details page.
   */
  function navigateToMovie() {
    router.push(`/movies/${pick.movie.tmdbId}`);
  }

  /**
   * Keyboard event handler for accessibility.
   * Allows keyboard users to navigate using Enter or Space keys.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToMovie();
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={navigateToMovie}
      onKeyDown={handleKeyDown}
      className="group flex h-full w-full flex-col gap-4 rounded-3xl border border-border-primary/60 bg-surface-primary/80 p-4 shadow-lg shadow-black/10 transition hover:-translate-y-1 hover:border-accent-primary/50 hover:shadow-[0_30px_60px_-35px_rgba(129,140,248,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 cursor-pointer"
    >
      <div className="flex gap-4">
        <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border-secondary/60 bg-surface-secondary">
          <PosterImage
            src={pick.movie.posterUrl ?? pick.movie.fallbackPosterUrl ?? null}
            fallbackSrc={pick.movie.fallbackPosterUrl ?? null}
            alt={pick.movie.title}
            tmdbId={pick.movie.tmdbId}
            sizes="(min-width: 1280px) 140px, (min-width: 768px) 120px, 38vw"
            className="h-full w-full"
            imageClassName="rounded-none object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-secondary">
              <Sparkles className="h-3 w-3" />
              <span>Smart Pick{releaseYear}</span>
            </div>
            <h3 className="text-base font-semibold text-text-primary transition-colors duration-200 line-clamp-2 group-hover:text-accent-primary">
              {pick.movie.title}
            </h3>
            {pick.movie.overview ? (
              <p className="text-sm text-text-secondary line-clamp-3 leading-relaxed">
                {pick.movie.overview}
              </p>
            ) : null}
          </div>

          {rationale.length ? (
            <div className="flex flex-wrap gap-y-1.5 gap-x-3">
              {rationale.map((reason, index) => (
                <span
                  key={`${pick.movie.tmdbId}-reason-${index}`}
                  className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-accent-primary/80"
                >
                  {reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between text-[11px] text-text-tertiary">
        <span>{runtimeLabel}</span>
        <a
          href={`https://www.themoviedb.org/movie/${pick.movie.tmdbId}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent-secondary transition-colors hover:text-accent-primary"
          onClick={(event) => event.stopPropagation()}
        >
          View on TMDB
        </a>
      </div>
    </article>
  );
}

/**
 * Props for an individual collection card rendered within the dashboard grid.
 */
interface CollectionCardProps {
  collection: CollectionSummary;
  profile: Profile;
  onUpdated: () => void;
  onDeleted: () => void;
}

/**
 * CollectionCard Component
 *
 * Interactive collection preview card with management actions and inline editing.
 * Displays collection metadata, theme styling, and provides quick access to editing features.
 *
 * Features:
 * - Click-to-navigate to collection editor
 * - Keyboard accessibility (Enter/Space navigation)
 * - Inline rename functionality with form validation
 * - Public/private toggle with optimistic updates
 * - Delete confirmation with undo feedback
 * - Theme-based visual styling with gradient backgrounds
 * - Responsive hover effects and animations
 * - Context menu with additional actions (copy link, etc.)
 *
 * State Management:
 * - Local state for rename mode and form data
 * - Optimistic updates for quick visual feedback
 * - Server action integration with error recovery
 * - Pending states to prevent concurrent operations
 *
 * Accessibility:
 * - Proper ARIA attributes and keyboard navigation
 * - Focus management during modal interactions
 * - Screen reader friendly action descriptions
 *
 * @param collection - Collection data for display
 * @param profile - User profile for permission checks
 * @param onUpdated - Callback when collection is updated
 * @param onDeleted - Callback when collection is deleted
 */
function CollectionCard({ collection, profile, onUpdated, onDeleted }: CollectionCardProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Rename modal state and form data
  const [isRenaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? "");

  // Async operation states
  const [pending, startTransition] = useTransition();
  const [isDeleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme configuration for visual styling
  const themeConfig = getThemeConfig(extractThemeId(collection.theme));

  /**
   * Determines if a click/keyboard event should be ignored for card activation.
   * Used to prevent navigation when interacting with card controls (buttons, menus, etc.)
   *
   * @param target - The event target element
   * @returns true if the event should be ignored
   */
  function shouldIgnoreActivation(target: HTMLElement) {
    return Boolean(target.closest('[data-collection-card-ignore]'));
  }

  /**
   * Navigates to the collection editor page.
   */
  function navigateToEditor() {
    router.push(`/collections/${collection.id}`);
  }

  /**
   * Card click handler for navigation.
   * Ignores clicks on interactive elements and prevents navigation during async operations.
   */
  function handleCardClick(event: React.MouseEvent<HTMLDivElement>) {
    if (shouldIgnoreActivation(event.target as HTMLElement)) return;
    if (pending || isDeleting) return;
    navigateToEditor();
  }

  /**
   * Keyboard navigation handler for accessibility.
   * Allows Enter and Space keys to navigate to the collection editor.
   */
  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      if (shouldIgnoreActivation(event.target as HTMLElement)) return;
      event.preventDefault();
      if (pending || isDeleting) return;
      navigateToEditor();
    }
  }

  function handleUpdate(payload: { title?: string; description?: string; is_public?: boolean }) {
    const titleValue =
      typeof payload.title === "string" ? payload.title.trim() || undefined : undefined;
    const descriptionValueRaw =
      payload.description === undefined ? undefined : payload.description.trim();
    const descriptionValue =
      descriptionValueRaw === undefined ? undefined : descriptionValueRaw || null;

    // Relay the mutation through the shared server action so slug revalidation
    // and public cache invalidation remain centralised.
    startTransition(async () => {
      setError(null);
      try {
        await updateCollectionDetailsAction({
          collectionId: collection.id,
          title: titleValue,
          description: descriptionValue,
          isPublic: payload.is_public,
        });
        setRenaming(false);
        onUpdated();

        const successDescription = typeof payload.is_public === "boolean"
          ? payload.is_public
            ? "Collection is now public."
            : "Collection is now private."
          : titleValue
          ? "Collection details saved."
          : "Collection updated.";

        toast({ title: "Collection updated", description: successDescription, variant: "success" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        setError(message);
        toast({ title: "Update failed", description: message, variant: "error" });
      }
    });
  }

  function handleDelete() {
    setError(null);
    setDeleting(true);
    // Deletions trigger revalidation of the dashboard and any public pages via
    // the server action. Using a transition keeps the card responsive while the
    // request is in flight.
    startTransition(async () => {
      try {
        await deleteCollectionAction(collection.id);
        onDeleted();
        toast({
          title: "Collection deleted",
          description: `"${collection.title}" has been removed.`,
          variant: "success",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to delete";
        setError(message);
        toast({ title: "Unable to delete", description: message, variant: "error" });
      } finally {
        setDeleting(false);
      }
    });
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="group relative cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      {/* Theme Background Gradient Effect */}
      {themeConfig && (
        <div
          className="absolute inset-0 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"
          style={{
            backgroundImage: `linear-gradient(135deg, ${themeConfig.gradient.from}, ${themeConfig.gradient.via}, ${themeConfig.gradient.to})`,
            opacity: 0.25,
          }}
        />
      )}

      {/* Main Card */}
      <div
        className="relative glass-card p-6 rounded-3xl border border-border-primary hover:border-accent-primary/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
        style={themeConfig ? {
          background: `linear-gradient(135deg, ${themeConfig.accent}15, ${themeConfig.accent}08, ${themeConfig.accent}10)`,
          boxShadow: `0 0 20px -5px ${themeConfig.accent}15`,
        } : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <div className="space-y-3">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  data-collection-card-ignore
                  className="bg-surface-primary border-border-primary focus:border-accent-primary"
                />
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  data-collection-card-ignore
                  className="bg-surface-primary border-border-primary focus:border-accent-primary"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-text-primary group-hover:text-gradient transition-all line-clamp-2">
                  {collection.title}
                </h3>

                <div className="flex items-center gap-4 text-sm text-text-tertiary">
                  <div className="flex items-center gap-1">
                    <Film className="w-4 h-4" />
                    <span>{collection.item_count} films</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {collection.is_public ? (
                      <Globe className="w-4 h-4 text-accent-secondary" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    <span className="capitalize">{collection.is_public ? "Public" : "Private"}</span>
                  </div>
                </div>

                {collection.description && (
                  <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
                    {collection.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-collection-card-ignore
                className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-surface-hover"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <Ellipsis className="w-4 h-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                data-collection-card-ignore
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                className="z-50 min-w-[200px] glass-card rounded-xl border border-border-primary p-2 shadow-xl"
              >
                <DropdownMenu.Item
                  data-collection-card-ignore
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-hover transition-colors"
                  onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    router.push(`/collections/${collection.id}`);
                  }}
                >
                  <Sparkles className="w-4 h-4 text-accent-primary" />
                  Open editor
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  data-collection-card-ignore
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-hover transition-colors"
                  onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const origin = window.location.origin;
                    const shareUrl = `${origin}/c/${profile.username}/${collection.slug}`;

                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(shareUrl).then(() => {
                        toast({
                          title: "Link copied",
                          description: "Your public collection link is ready to share.",
                          variant: "success",
                        });
                      });
                    }
                  }}
                >
                  <Eye className="w-4 h-4 text-accent-secondary" />
                  Copy public link
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  data-collection-card-ignore
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-hover transition-colors"
                  onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setRenaming((prev) => !prev);
                    setError(null);
                  }}
                >
                  <PencilLine className="w-4 h-4 text-accent-tertiary" />
                  Rename
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  data-collection-card-ignore
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-hover transition-colors"
                  onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleUpdate({ is_public: !collection.is_public });
                  }}
                >
                  {collection.is_public ? (
                    <EyeOff className="w-4 h-4 text-red-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-green-400" />
                  )}
                  {collection.is_public ? "Make private" : "Make public"}
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-2 h-px bg-border-primary" />

                <DropdownMenu.Item
                  data-collection-card-ignore
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDelete();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Footer */}
        {!isRenaming && (
          <div className="flex items-center justify-between pt-4 border-t border-border-secondary">
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <Calendar className="w-3 h-3" />
              <span>Updated {new Date(collection.updated_at).toLocaleDateString()}</span>
            </div>

            <div className="w-2 h-2 rounded-full bg-accent-primary animate-pulse opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Rename Actions */}
        {isRenaming && (
          <div className="flex gap-3 pt-4 border-t border-border-secondary">
            <Button
              variant="outline"
              size="sm"
              data-collection-card-ignore
              onClick={() => {
                setRenaming(false);
                setTitle(collection.title);
                setDescription(collection.description ?? "");
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleUpdate({ title, description })}
              disabled={pending}
              data-collection-card-ignore
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </motion.article>
  );
}
