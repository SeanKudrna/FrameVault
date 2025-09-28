"use client";

/**
 * Dashboard entry point that lists a member's collections with create controls
 * and per-card management menus. Client-side to support optimistic transitions
 * and dialogs.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Ellipsis, Eye, EyeOff, PencilLine, Plus, Sparkles, Trash2 } from "lucide-react";
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

const SMART_PICKS_STATE_KEY = "framevault:smart-picks-open";

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
export function CollectionsDashboard({ profile, collections, recommendations, tasteProfile }: CollectionsDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [smartPicksOpen, setSmartPicksOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const storedValue = window.localStorage.getItem(SMART_PICKS_STATE_KEY);

    if (storedValue === null) {
      return true;
    }

    return storedValue === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SMART_PICKS_STATE_KEY, smartPicksOpen ? "true" : "false");
  }, [smartPicksOpen]);

  const limit = PLAN_COLLECTION_LIMIT[profile.plan] ?? Infinity;
  // Plan gating logic ensures the UI matches server enforcement before the
  // member attempts to submit the create form.
  const canCreate = canCreateCollection(profile, collections.length);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmedTitle = formTitle.trim();
    const trimmedDescription = formDescription.trim();

    if (!trimmedTitle) {
      const message = "Please provide a title for your collection";
      setError(message);
      toast({ title: "Missing title", description: message, variant: "error" });
      return;
    }

    // Use a transition so the dialog remains interactive while the server
    // action executes and the router refreshes the list.
    startTransition(async () => {
      try {
        await createCollectionAction({
          title: trimmedTitle,
          description: trimmedDescription ? trimmedDescription : null,
        });
        setFormTitle("");
        setFormDescription("");
        setDialogOpen(false);
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

  return (
    <div className="space-y-8">
      {profile.plan === "pro" ? (
        <section
          className={cn(
            "rounded-3xl border border-slate-800/60 bg-slate-950/70 px-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.8)]",
            smartPicksOpen ? "space-y-6 pt-4 pb-6" : "space-y-3 pt-4 pb-1"
          )}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">Smart Picks for You</h2>
              <p className="text-sm text-slate-400">
                {tasteProfile?.topGenres?.length
                  ? `Inspired by your love of ${tasteProfile.topGenres
                      .slice(0, 2)
                      .map((genre) => genre.name)
                      .join(" & " )}`
                  : "Watch and curate more films to fine-tune your picks."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-[0.32em] text-indigo-200/80">Pro Exclusive</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSmartPicksOpen((previous) => !previous)}
                className="gap-2 text-xs text-indigo-200 hover:text-indigo-50"
                aria-expanded={smartPicksOpen}
                aria-controls="smart-picks-panel"
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform ${smartPicksOpen ? "rotate-180" : "rotate-0"}`}
                />
                {smartPicksOpen ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          {smartPicksOpen ? (
            recommendations && recommendations.length > 0 ? (
              <div id="smart-picks-panel" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recommendations.map((pick) => (
                  <SmartPickCard key={pick.movie.tmdbId} pick={pick} />
                ))}
              </div>
            ) : (
              <div
                id="smart-picks-panel"
                className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/40 p-8 text-center text-sm text-slate-400"
              >
                Add a few more ratings or build out your shelves to unlock tailored recommendations.
              </div>
            )
          ) : (
            <div id="smart-picks-panel" className="hidden" aria-hidden="true" />
          )}
        </section>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Your collections</h1>
          <p className="text-sm text-slate-400">Craft, reorder, and publish the sets that define your taste.</p>
        </div>
        <Dialog.Root open={isDialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Trigger asChild>
            <Button size="lg" disabled={!canCreate}>
              <Plus size={18} />
              New collection
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-6 rounded-3xl border border-slate-800/70 bg-slate-950/80 p-8 shadow-2xl focus:outline-none">
              <Dialog.Title className="text-2xl font-semibold">Create a collection</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-400">
                Title your next cinematic theme and optionally describe the vibe.
              </Dialog.Description>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.24em] text-slate-500" htmlFor="collection-title">
                    Title
                  </label>
                  <Input
                    id="collection-title"
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    placeholder="Midnight Monologues"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.24em] text-slate-500" htmlFor="collection-description">
                    Description
                  </label>
                  <Textarea
                    id="collection-description"
                    value={formDescription}
                    onChange={(event) => setFormDescription(event.target.value)}
                    placeholder="A descent into the quiet tension of late-night conversations"
                  />
                </div>
                {error ? <p className="text-sm text-rose-400">{error}</p> : null}
                <div className="flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <Button variant="ghost">Cancel</Button>
                  </Dialog.Close>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {!canCreate && limit !== Infinity ? (
        <PlanGate
          title="You’ve reached the free tier limit"
          message={planGateMessage(profile)}
          ctaLabel="Upgrade to Plus"
          href="/settings/billing"
        />
      ) : null}

      <AnimatePresence mode="popLayout">
        {collections.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="rounded-3xl border border-dashed border-slate-700/60 bg-slate-900/40 p-12 text-center"
          >
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-indigo-300" />
            <h2 className="text-xl font-semibold text-slate-100">Start your first collection</h2>
            <p className="mt-2 text-sm text-slate-400">
              Give it a name, search TMDB for films, drag to reorder, and share once it feels perfect.
            </p>
            <Button className="mt-6" onClick={() => setDialogOpen(true)}>
              <Plus size={18} />
              Create collection
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            layout
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                profile={profile}
                onUpdated={() => router.refresh()}
                onDeleted={() => router.refresh()}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SmartPickCardProps {
  pick: SmartPick;
}

function SmartPickCard({ pick }: SmartPickCardProps) {
  const releaseYear = pick.movie.releaseYear ? `• ${pick.movie.releaseYear}` : "";
  return (
    <div className="group flex gap-4 overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/40 p-4 transition-shadow hover:shadow-[0_24px_60px_-40px_rgba(129,140,248,0.6)]">
      <PosterImage
        src={pick.movie.posterUrl ?? pick.movie.fallbackPosterUrl ?? null}
        alt={pick.movie.title}
        className="h-[180px] w-[120px] flex-shrink-0 rounded-2xl"
        imageClassName="rounded-2xl"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold leading-tight text-slate-100 break-words">
            {pick.movie.title}
          </h3>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Smart Pick {releaseYear}
          </p>
          {pick.rationale.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pick.rationale.map((reason, index) => (
                <span
                  key={`${reason}-${index}`}
                  className="max-w-full rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100 leading-snug"
                >
                  {reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <a
            href={`https://www.themoviedb.org/movie/${pick.movie.tmdbId}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-indigo-200 transition-colors hover:text-indigo-100"
          >
            View on TMDB
          </a>
          <span aria-hidden="true" className="hidden sm:inline">
            •
          </span>
          <span>{pick.movie.runtime ? `${pick.movie.runtime} min` : "Feature"}</span>
        </div>
      </div>
    </div>
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
 * Interactive card showing collection details, quick actions, and context menus.
 */
function CollectionCard({ collection, profile, onUpdated, onDeleted }: CollectionCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isRenaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? "");
  const [pending, startTransition] = useTransition();
  const [isDeleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function shouldIgnoreActivation(target: HTMLElement) {
    return Boolean(target.closest('[data-collection-card-ignore]'));
  }

  function navigateToEditor() {
    router.push(`/collections/${collection.id}`);
  }

  function handleCardClick(event: React.MouseEvent<HTMLDivElement>) {
    if (shouldIgnoreActivation(event.target as HTMLElement)) return;
    if (pending || isDeleting) return;
    navigateToEditor();
  }

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
      className="group flex h-full cursor-pointer flex-col justify-between rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)]"
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {isRenaming ? (
              <div className="space-y-2">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  data-collection-card-ignore
                />
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  data-collection-card-ignore
                />
              </div>
            ) : (
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-100">{collection.title}</h2>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{collection.item_count} titles</p>
                {collection.description ? (
                  <p className="text-sm text-slate-400">{collection.description}</p>
                ) : null}
              </div>
            )}
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-collection-card-ignore
                className="h-10 w-10 rounded-xl border border-transparent bg-transparent text-slate-400 transition-colors focus-visible:border-indigo-400/60 focus-visible:bg-slate-900/70 hover:border-indigo-400/60 hover:bg-slate-900/70 data-[state=open]:border-indigo-400/60 data-[state=open]:bg-slate-900/70"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <Ellipsis size={18} />
              </Button>
            </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              data-collection-card-ignore
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              className="z-50 min-w-[180px] rounded-xl border border-slate-800/70 bg-slate-900/90 p-2 text-sm text-slate-100 shadow-xl"
            >
              <DropdownMenu.Item
                data-collection-card-ignore
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800/80"
                onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    router.push(`/collections/${collection.id}`);
                  }}
                >
                  <Sparkles size={16} />
                  Open editor
                </DropdownMenu.Item>
              <DropdownMenu.Item
                data-collection-card-ignore
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800/80"
                onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const origin =
                      typeof window !== "undefined"
                        ? window.location.origin
                        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
                    const shareUrl = `${origin}/c/${profile.username}/${collection.slug}`;

                    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                      navigator.clipboard
                        .writeText(shareUrl)
                        .then(() => {
                          toast({
                            title: "Link copied",
                            description: "Your public collection link is ready to share.",
                            variant: "success",
                          });
                        })
                        .catch(() => {
                          toast({
                            title: "Copy failed",
                            description: "Copy the link manually from the address bar.",
                            variant: "error",
                          });
                        });
                    } else {
                      toast({
                        title: "Clipboard unavailable",
                        description: "Copy the link manually from the address bar.",
                        variant: "info",
                      });
                    }
                  }}
                >
                  <Eye size={16} />
                  Copy public link
                </DropdownMenu.Item>
              <DropdownMenu.Item
                data-collection-card-ignore
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800/80"
                onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setRenaming((prev) => !prev);
                    setError(null);
                  }}
                >
                  <PencilLine size={16} />
                  Rename
                </DropdownMenu.Item>
              <DropdownMenu.Item
                data-collection-card-ignore
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800/80"
                onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleUpdate({ is_public: !collection.is_public });
                  }}
                >
                  {collection.is_public ? <EyeOff size={16} /> : <Eye size={16} />}
                  {collection.is_public ? "Make private" : "Make public"}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-2 h-px bg-slate-800/70" />
              <DropdownMenu.Item
                data-collection-card-ignore
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-rose-400 hover:bg-rose-500/10"
                onSelect={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDelete();
                  }}
                >
                  <Trash2 size={16} />
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {isRenaming ? (
    <div className="mt-4 flex gap-3 text-sm">
      <Button
        variant="muted"
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
        onClick={() =>
          handleUpdate({ title, description })
        }
        disabled={pending}
        data-collection-card-ignore
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  ) : (
        <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
          <span>{collection.is_public ? "Public" : "Private"}</span>
          <span>{new Date(collection.updated_at).toLocaleDateString()}</span>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
    </motion.article>
  );
}
