"use client";

/**
 * Interactive editor for managing collection metadata, items, and publication
 * state. Handles drag-and-drop ordering, TMDB search integration, and server
 * action orchestration from the client.
 */

import Image from "next/image";
import {
  memo,
  startTransition as startAppTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Eye, EyeOff, GripVertical, Plus, Trash2, Ellipsis, CheckCircle2, PlayCircle, BookmarkPlus, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MovieSearchModal } from "@/components/collections/movie-search-modal";
import { useToast } from "@/components/providers/toast-provider";
import { PosterImage } from "@/components/media/poster-image";
import { cn } from "@/lib/utils";
import { COLLECTION_THEME_OPTIONS, extractThemeId, getThemeConfig } from "@/lib/themes";
import type { CollectionThemeOption } from "@/lib/themes";
import { PlanGate } from "@/components/plan/plan-gate";
import {
  addMovieToCollectionAction,
  removeCollectionItemAction,
  reorderCollectionItemsAction,
  updateCollectionDetailsAction,
  updateCollectionItemNoteAction,
  setViewStatusAction,
  uploadCollectionCoverAction,
} from "@/app/(app)/collections/actions";
import type { CollectionItemWithMovie } from "@/types/collection";
import type { MovieSummary } from "@/lib/tmdb";
import type { Profile, WatchStatus } from "@/lib/supabase/types";

/**
 * DOM id referenced by the drag-and-drop accessibility instructions element.
 */
const DND_INSTRUCTIONS_ID = "framevault-dnd-instructions";
/**
 * Screen reader guidance describing how to reorder items with the keyboard.
 */
const DND_SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "Press space bar to pick up an item. Use the arrow keys to move, space bar to drop, and escape to cancel.",
} as const;

const STATUS_CONFIG: Record<WatchStatus, { label: string; Icon: LucideIcon; pillClass: string; menuLabel: string }> = {
  watched: {
    label: "Watched",
    Icon: CheckCircle2,
    pillClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
    menuLabel: "Mark as watched",
  },
  watching: {
    label: "Watching",
    Icon: PlayCircle,
    pillClass: "border-sky-500/40 bg-sky-500/10 text-sky-100",
    menuLabel: "Mark as watching",
  },
  want: {
    label: "Watchlist",
    Icon: BookmarkPlus,
    pillClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-100",
    menuLabel: "Add to watchlist",
  },
};

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

async function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image"));
    img.src = dataUrl;
  });
}

async function cropImageToCover(file: File) {
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImage(dataUrl);

  const targetWidth = 1600;
  const targetHeight = 900;
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = image.width / image.height;

  let sx = 0;
  let sy = 0;
  let sWidth = image.width;
  let sHeight = image.height;

  if (sourceAspect > targetAspect) {
    sHeight = image.height;
    sWidth = sHeight * targetAspect;
    sx = (image.width - sWidth) / 2;
  } else {
    sWidth = image.width;
    sHeight = sWidth / targetAspect;
    sy = (image.height - sHeight) / 2;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }
  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Unable to process image"));
    }, "image/jpeg", 0.92);
  });

  return new File([blob], `collection-cover-${Date.now()}.jpg`, { type: "image/jpeg" });
}

/**
 * Props required to render the collection editor.
 */
interface CollectionEditorProps {
  collection: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    previous_slugs: string[];
    is_public: boolean;
    created_at: string;
    updated_at: string;
    cover_image_url: string | null;
    theme: Record<string, unknown> | null;
  };
  profile: Profile;
  items: CollectionItemWithMovie[];
}

/**
 * Full-featured editor for managing a collection's metadata and item order.
 */
export function CollectionEditor({ collection, profile, items: initialItems }: CollectionEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a slight drag distance before activation to avoid accidental
      // reorder gestures while clicking controls inside a card.
      activationConstraint: { distance: 8 },
    })
  );
  const [items, setItems] = useState(() => initialItems);
  const [, setActiveId] = useState<string | null>(null);
  const dragOriginItemsRef = useRef<CollectionItemWithMovie[]>(initialItems);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? "");
  const [isPublic, setIsPublic] = useState(collection.is_public);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(collection.cover_image_url);
  const [isUploadingCover, setUploadingCover] = useState(false);
  const [isSavingTheme, setSavingTheme] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<CollectionThemeOption | null>(() =>
    getThemeConfig(extractThemeId(collection.theme))
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canCustomize = profile.plan !== "free";

  useEffect(() => {
    setItems(initialItems);
    dragOriginItemsRef.current = initialItems;
  }, [initialItems]);

  useEffect(() => {
    setTitle(collection.title);
    setDescription(collection.description ?? "");
    setIsPublic(collection.is_public);
  }, [collection.id, collection.title, collection.description, collection.is_public]);

  useEffect(() => {
    setCoverImageUrl(collection.cover_image_url);
    setSelectedTheme(getThemeConfig(extractThemeId(collection.theme)));
  }, [collection.cover_image_url, collection.theme]);

  const existingTmdbIds = useMemo(() => items.map((item) => item.tmdb_id), [items]);
  const handleAddMovie = useCallback(
    /**
     * Adds a TMDB movie to the collection via server action and refreshes the page on success.
     */
    (movie: MovieSummary) => {
      startTransition(async () => {
        try {
          await addMovieToCollectionAction({
            collectionId: collection.id,
            movie,
          });
          setError(null);
          toast({
            title: "Movie added",
            description: `${movie.title} joined "${collection.title}".`,
            variant: "success",
          });
          router.refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to add movie";
          setError(message);
          toast({ title: "Unable to add movie", description: message, variant: "error" });
        }
      });
    },
    [collection.id, collection.title, router, startTransition, toast]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    dragOriginItemsRef.current = items.map((item) => ({ ...item }));
    setActiveId(event.active.id as string);
  }, [items]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setItems(dragOriginItemsRef.current.map((item) => ({ ...item })));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;

      const currentItems = items;
      const oldIndex = currentItems.findIndex((item) => item.id === active.id);
      const newIndex = currentItems.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const originSnapshot = dragOriginItemsRef.current.map((item) => ({ ...item }));
      const reordered = arrayMove(currentItems, oldIndex, newIndex).map((item, index) => ({
        ...item,
        position: index,
      }));

      setItems(reordered);

      // Persist the new ordering via server action, reverting the UI if the
      // mutation fails. Using `startTransition` keeps the UI responsive during
      // the async round-trip.
      startTransition(async () => {
        try {
          await reorderCollectionItemsAction({
            collectionId: collection.id,
            orderedIds: reordered.map((item) => ({ id: item.id, position: item.position })),
          });
          dragOriginItemsRef.current = reordered.map((item) => ({ ...item }));
          setError(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to reorder";
          setError(message);
          toast({ title: "Unable to reorder", description: message, variant: "error" });
          setItems(originSnapshot);
          dragOriginItemsRef.current = originSnapshot.map((item) => ({ ...item }));
        }
      });
    },
    [collection.id, items, startTransition, toast]
  );

  const handleSaveDetails = useCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    startTransition(async () => {
      try {
        await updateCollectionDetailsAction({
          collectionId: collection.id,
          title: trimmedTitle || undefined,
          description: trimmedDescription ? trimmedDescription : null,
        });
        setError(null);
        toast({ title: "Collection saved", description: "Details updated successfully.", variant: "success" });
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to save details";
        setError(message);
        toast({ title: "Unable to save", description: message, variant: "error" });
      }
    });
  }, [collection.id, description, router, startTransition, title, toast]);

  const handleToggleVisibility = useCallback(() => {
    const nextIsPublic = !isPublic;
    startTransition(async () => {
      try {
        await updateCollectionDetailsAction({
          collectionId: collection.id,
          isPublic: nextIsPublic,
        });
        setIsPublic(nextIsPublic);
        setError(null);
        toast({
          title: nextIsPublic ? "Collection published" : "Collection hidden",
          description: nextIsPublic
            ? "Your collection is now visible to anyone with the link."
            : "The collection is private again.",
          variant: "success",
        });
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update visibility";
        setError(message);
        toast({ title: "Update failed", description: message, variant: "error" });
      }
    });
  }, [collection.id, isPublic, router, startTransition, toast]);

  const handleRemoveItem = useCallback(
    (item: CollectionItemWithMovie) => {
      // Removal triggers both the mutation and a route refresh so server data
      // stays authoritative (e.g., revalidated counts, slug revalidation).
      startTransition(async () => {
        try {
          await removeCollectionItemAction({
            collectionItemId: item.id,
            collectionId: collection.id,
          });
          setError(null);
          toast({
            title: "Removed from collection",
            description: `${item.movie?.title ?? "Movie"} was removed.`,
            variant: "success",
          });
          router.refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to remove";
          setError(message);
          toast({ title: "Unable to remove", description: message, variant: "error" });
        }
      });
    },
    [collection.id, router, startTransition, toast]
  );

  const handleNoteSave = useCallback(
    (item: CollectionItemWithMovie, note: string) => {
      // Notes are lightweight text fields, but we still funnel through the
      // server action to persist immediately and trigger route revalidation.
      startTransition(async () => {
        try {
          await updateCollectionItemNoteAction({
            collectionItemId: item.id,
            note,
            collectionId: collection.id,
          });
          setError(null);
          toast({
            title: "Note saved",
            description: `${item.movie?.title ?? "Movie"} note updated.`,
            variant: "success",
          });
          router.refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to save note";
          setError(message);
          toast({ title: "Unable to save note", description: message, variant: "error" });
        }
      });
    },
    [collection.id, router, startTransition, toast]
  );

  const handleUpdateStatus = useCallback(
    async (tmdbId: number, nextStatus: WatchStatus | null, options?: { watchedAt?: string | null }) => {
      try {
        await setViewStatusAction({
          tmdbId,
          status: nextStatus,
          watchedAt: options?.watchedAt,
        });

        if (nextStatus) {
          const copy: Record<WatchStatus, { title: string; description: string }> = {
            watched: {
              title: "Marked as watched",
              description: "We'll log this screening in your history feed.",
            },
            watching: {
              title: "Marked as watching",
              description: "We'll keep this handy so you can resume later.",
            },
            want: {
              title: "Saved to watchlist",
              description: "Reach it from your history when you're ready to press play.",
            },
          };
          const message = copy[nextStatus];
          toast({ title: message.title, description: message.description, variant: "success" });
        } else {
          toast({
            title: "Status cleared",
            description: "This film is no longer tracked in your history.",
            variant: "info",
          });
        }

        startAppTransition(() => {
          router.refresh();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update status";
        toast({ title: "Status update failed", description: message, variant: "error" });
        throw error;
      }
    },
    [router, toast]
  );

  const handleCoverFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast({ title: "Unsupported file", description: "Please choose an image file.", variant: "error" });
        event.target.value = "";
        return;
      }
      if (!canCustomize) {
        toast({ title: "Upgrade required", description: "Plus unlocks custom covers.", variant: "info" });
        event.target.value = "";
        return;
      }

      setUploadingCover(true);
      try {
        const processed = await cropImageToCover(file);
        const formData = new FormData();
        formData.append("collectionId", collection.id);
        formData.append("file", processed);
        const result = await uploadCollectionCoverAction(formData);
        setCoverImageUrl(result.url);
        toast({
          title: "Cover updated",
          description: "Your collection now has a cinematic hero image.",
          variant: "success",
        });
        startAppTransition(() => {
          router.refresh();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload cover";
        toast({ title: "Upload failed", description: message, variant: "error" });
      } finally {
        setUploadingCover(false);
        event.target.value = "";
      }
    },
    [canCustomize, collection.id, router, toast]
  );

  const handleCoverRemove = useCallback(() => {
    if (!canCustomize || !coverImageUrl) return;
    setUploadingCover(true);
    const previous = coverImageUrl;
    setCoverImageUrl(null);
    updateCollectionDetailsAction({ collectionId: collection.id, coverImageUrl: null })
      .then(() => {
        toast({ title: "Cover removed", description: "Reverted to the default background.", variant: "info" });
        startAppTransition(() => {
          router.refresh();
        });
      })
      .catch((error) => {
        setCoverImageUrl(previous);
        const message = error instanceof Error ? error.message : "Unable to remove cover";
        toast({ title: "Remove failed", description: message, variant: "error" });
      })
      .finally(() => setUploadingCover(false));
  }, [canCustomize, collection.id, coverImageUrl, router, toast]);

  const handleThemeSelect = useCallback(
    async (option: CollectionThemeOption) => {
      if (!canCustomize) {
        toast({ title: "Upgrade required", description: "Plus unlocks accent themes.", variant: "info" });
        return;
      }
      const previous = selectedTheme;
      setSelectedTheme(option);
      setSavingTheme(true);
      try {
        await updateCollectionDetailsAction({ collectionId: collection.id, theme: { id: option.id } });
        toast({ title: "Theme applied", description: `${option.label} is now active.`, variant: "success" });
        startAppTransition(() => {
          router.refresh();
        });
      } catch (error) {
        setSelectedTheme(previous ?? null);
        const message = error instanceof Error ? error.message : "Unable to update theme";
        toast({ title: "Theme update failed", description: message, variant: "error" });
      } finally {
        setSavingTheme(false);
      }
    },
    [canCustomize, collection.id, router, selectedTheme, toast]
  );

  const handleResetTheme = useCallback(async () => {
    if (!canCustomize || !selectedTheme) return;
    setSavingTheme(true);
    const previous = selectedTheme;
    setSelectedTheme(null);
    try {
      await updateCollectionDetailsAction({ collectionId: collection.id, theme: null });
      toast({ title: "Theme reset", description: "Back to the default palette.", variant: "info" });
      startAppTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSelectedTheme(previous);
      const message = error instanceof Error ? error.message : "Unable to reset theme";
      toast({ title: "Theme update failed", description: message, variant: "error" });
    } finally {
      setSavingTheme(false);
    }
  }, [canCustomize, collection.id, router, selectedTheme, toast]);

  // Assemble the share URL using the browser origin when available. Falls back
  // to the configured site URL during SSR so the UI still shows a reasonable
  // link while hydrating.
  const shareUrl =
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") +
    `/c/${profile.username}/${collection.slug}`;

  const themePreview = selectedTheme ?? getThemeConfig(extractThemeId(collection.theme));

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.9)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-100">Appearance</h2>
            <p className="text-sm text-slate-400">Upload a cinematic cover and choose an accent palette for public pages.</p>
          </div>
          {!canCustomize ? (
            <PlanGate
              title="Unlock custom branding"
              message="Plus members can upload cover art and theme their collections."
              ctaLabel="Upgrade to Plus"
              href="/settings/billing"
            />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-5 lg:flex-row">
                <div className="flex-1 space-y-3">
                  <p className="text-sm font-semibold text-slate-200">Cover image</p>
                  <div
                    className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/70"
                    style={themePreview ? { backgroundImage: `linear-gradient(135deg, ${themePreview.gradient.from}, ${themePreview.gradient.via}, ${themePreview.gradient.to})` } : undefined}
                  >
                    {coverImageUrl ? (
                      <Image src={coverImageUrl} alt="Collection cover" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                        Upload a 16:9 image for the best look
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="muted" onClick={() => fileInputRef.current?.click()} disabled={isUploadingCover}>
                      {isUploadingCover ? "Uploading..." : "Upload cover"}
                    </Button>
                    {coverImageUrl ? (
                      <Button variant="ghost" onClick={handleCoverRemove} disabled={isUploadingCover}>
                        Remove cover
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-200">Accent theme</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {COLLECTION_THEME_OPTIONS.map((option) => {
                    const isActive = selectedTheme?.id === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleThemeSelect(option)}
                        disabled={isSavingTheme}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border px-4 py-6 text-left transition focus:outline-none",
                          isActive
                            ? "border-indigo-400/60 ring-2 ring-indigo-400/30"
                            : "border-slate-800/60 hover:border-indigo-400/40"
                        )}
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${option.gradient.from}, ${option.gradient.via}, ${option.gradient.to})`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-black/25 to-black/40" />
                        <div className="relative space-y-2 text-slate-100">
                          <p className="text-sm font-semibold">{option.label}</p>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.accent }} />
                            Accent
                          </span>
                          {isActive ? <span className="text-[10px] uppercase tracking-[0.24em] text-indigo-100">Selected</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-slate-800/60"
                  onClick={handleResetTheme}
                  disabled={isSavingTheme || !selectedTheme}
                >
                  Reset theme
                </Button>
              </div>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileChange} />
      </section>

      <header className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Title</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 text-lg" />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Description</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What story does this curation tell?"
                className="min-h-[120px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <span>Share link:</span>
              <code className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-indigo-200">{shareUrl}</code>
              <Button
                variant="ghost"
                size="sm"
                disabled={!isPublic}
                onClick={() => {
                  if (!isPublic) return;
                  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                    navigator.clipboard
                      .writeText(shareUrl)
                      .then(() =>
                        toast({
                          title: "Link copied",
                          description: "Share URL copied to your clipboard.",
                          variant: "success",
                        })
                      )
                      .catch(() =>
                        toast({
                          title: "Copy failed",
                          description: "Copy the link manually from the address bar.",
                          variant: "error",
                        })
                      );
                  } else {
                    toast({
                      title: "Clipboard unavailable",
                      description: "Copy the link manually from the address bar.",
                      variant: "info",
                    });
                  }
                }}
              >
                Copy
              </Button>
              <span className="text-xs text-slate-500">{isPublic ? "Live and viewable" : "Set to public before sharing"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={handleSaveDetails} disabled={pending}>
              {pending ? "Saving..." : "Save details"}
            </Button>
            <Button variant="muted" onClick={handleToggleVisibility} disabled={pending}>
              {isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
              {isPublic ? "Make private" : "Make public"}
            </Button>
            <Button variant="muted" onClick={() => setSearchOpen(true)}>
              <Plus size={16} />
              Add movie
            </Button>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Titles</h2>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={[restrictToVerticalAxis]}
          accessibility={{
            describedById: DND_INSTRUCTIONS_ID,
            screenReaderInstructions: DND_SCREEN_READER_INSTRUCTIONS,
          }}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {items.map((item) => (
                <SortableMovieCard
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemoveItem(item)}
                  onSaveNote={(note) => handleNoteSave(item, note)}
                  onUpdateStatus={(status, options) => handleUpdateStatus(item.tmdb_id, status, options)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay />
        </DndContext>
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800/70 bg-slate-950/40 p-12 text-center text-sm text-slate-400">
            No films yet. Use the Add movie action to start this collection.
          </div>
        ) : null}
      </section>

      <MovieSearchModal
        open={isSearchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleAddMovie}
        existingTmdbIds={existingTmdbIds}
      />
    </div>
  );
}

/**
 * Props for a sortable movie card row.
 */
interface SortableMovieCardProps {
  item: CollectionItemWithMovie;
  onRemove: () => void;
  onSaveNote: (note: string) => void;
  onUpdateStatus: (status: WatchStatus | null, options?: { watchedAt?: string | null }) => Promise<void>;
}

/**
 * Sortable wrapper that wires a movie card into the DnD context.
 */
const SortableMovieCard = memo(function SortableMovieCard({
  item,
  onRemove,
  onSaveNote,
  onUpdateStatus,
}: SortableMovieCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [note, setNote] = useState(item.note ?? "");
  const [status, setStatus] = useState<WatchStatus | null>(item.viewStatus ?? null);
  const [watchedAt, setWatchedAt] = useState<string | null>(item.watchedAt ?? null);
  const [statusPending, setStatusPending] = useState(false);

  useEffect(() => {
    setNote(item.note ?? "");
  }, [item.note]);

  useEffect(() => {
    setStatus(item.viewStatus ?? null);
    setWatchedAt(item.watchedAt ?? null);
  }, [item.viewStatus, item.watchedAt]);

  const handleStatusChange = useCallback(
    async (nextStatus: WatchStatus | null, options?: { watchedAt?: string | null }) => {
      const previousStatus = status;
      const previousWatchedAt = watchedAt;
      setStatus(nextStatus);
      setWatchedAt(nextStatus === "watched" ? options?.watchedAt ?? new Date().toISOString() : null);
      setStatusPending(true);
      try {
        await onUpdateStatus(nextStatus, options);
        if (nextStatus !== "watched") {
          setWatchedAt(null);
        } else if (options?.watchedAt) {
          setWatchedAt(options.watchedAt);
        }
      } catch {
        setStatus(previousStatus ?? null);
        setWatchedAt(previousWatchedAt ?? null);
      } finally {
        setStatusPending(false);
      }
    },
    [onUpdateStatus, status, watchedAt]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-[0_12px_50px_-40px_rgba(15,23,42,1)] transition ${
        isDragging ? "ring-2 ring-indigo-400" : ""
      }`}
    >
      <MovieCardBody
        item={item}
        note={note}
        onNoteChange={setNote}
        onRemove={onRemove}
        onSaveNote={onSaveNote}
        viewStatus={status}
        watchedAt={watchedAt}
        onUpdateStatus={handleStatusChange}
        statusPending={statusPending}
        dragHandleProps={{
          ...attributes,
          ...listeners,
        }}
      />
    </div>
  );
});
SortableMovieCard.displayName = "SortableMovieCard";


/**
 * Props for the shared movie card body rendered in both editable and read-only contexts.
 */
interface MovieCardBodyProps {
  item: CollectionItemWithMovie;
  note?: string;
  onNoteChange?: (value: string) => void;
  onRemove?: () => void;
  onSaveNote?: (note: string) => void;
  dragHandleProps?: Record<string, unknown>;
  readOnly?: boolean;
  viewStatus?: WatchStatus | null;
  watchedAt?: string | null;
  onUpdateStatus?: (status: WatchStatus | null, options?: { watchedAt?: string | null }) => Promise<void>;
  statusPending?: boolean;
}

/**
 * Displays poster art, title, and note editor for a collection item. Supports read-only mode.
 */
function MovieCardBody({
  item,
  note,
  onNoteChange,
  onRemove,
  onSaveNote,
  dragHandleProps,
  readOnly = false,
  viewStatus = null,
  watchedAt = null,
  onUpdateStatus,
  statusPending = false,
}: MovieCardBodyProps) {
  const formattedWatchedAt = useMemo(() => {
    if (!watchedAt) return null;
    const date = new Date(watchedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }, [watchedAt]);

  const statusMeta = useMemo(() => {
    if (!viewStatus) return null;
    const config = STATUS_CONFIG[viewStatus];
    return {
      ...config,
      watchHint: viewStatus === "watched" && formattedWatchedAt ? `Watched ${formattedWatchedAt}` : null,
    };
  }, [formattedWatchedAt, viewStatus]);

  const statusEntries = useMemo(
    () => Object.entries(STATUS_CONFIG) as Array<[WatchStatus, (typeof STATUS_CONFIG)[WatchStatus]]>,
    []
  );

  return (
    <div className="flex gap-4">
      {dragHandleProps ? (
        <button
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-800/70 bg-slate-900/60 text-slate-500 transition hover:border-indigo-400/70 hover:bg-slate-900/80 hover:text-indigo-200 cursor-grab active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical size={18} />
        </button>
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-800/70 bg-slate-900/60 text-slate-600">
          <GripVertical size={18} />
        </div>
      )}
      <div className="flex w-full gap-4">
        <div className="relative h-28 w-20 overflow-hidden rounded-xl">
          <PosterImage
            src={item.movie?.posterUrl ?? null}
            fallbackSrc={item.movie?.fallbackPosterUrl ?? null}
            alt={item.movie?.title ?? "Poster"}
            sizes="120px"
            tmdbId={item.movie?.tmdbId ?? null}
          />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-100">{item.movie?.title ?? "Untitled"}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.movie?.releaseYear ?? ""}</p>
              {statusMeta ? (
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                    statusMeta.pillClass
                  )}
                >
                  <statusMeta.Icon size={16} />
                  {statusMeta.label}
                  {statusMeta.watchHint ? <span className="text-[10px] uppercase tracking-[0.18em] text-current/70">{statusMeta.watchHint}</span> : null}
                </span>
              ) : null}
            </div>
            {!readOnly ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="icon" disabled={statusPending}>
                    <Ellipsis size={16} />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    className="w-56 rounded-2xl border border-slate-800/70 bg-slate-950/90 p-2 text-sm text-slate-200 shadow-[0_16px_80px_-60px_rgba(15,23,42,1)] backdrop-blur"
                  >
                    <DropdownMenu.Label className="px-3 pb-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                      Status
                    </DropdownMenu.Label>
                    {statusEntries.map(([key, config]) => (
                      <DropdownMenu.Item
                        key={key}
                        disabled={statusPending}
                        onSelect={() => {
                          if (key === "watched") {
                            onUpdateStatus?.("watched", { watchedAt: new Date().toISOString() });
                          } else {
                            onUpdateStatus?.(key);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 outline-none transition",
                          viewStatus === key
                            ? "bg-indigo-500/15 text-indigo-100"
                            : "hover:bg-slate-900/80 hover:text-slate-100"
                        )}
                      >
                        <config.Icon size={16} />
                        <span>{config.menuLabel}</span>
                        {viewStatus === key ? <span className="ml-auto text-[10px] uppercase tracking-[0.24em] text-indigo-200">Active</span> : null}
                      </DropdownMenu.Item>
                    ))}
                    <DropdownMenu.Item
                      disabled={!viewStatus || statusPending}
                      onSelect={() => onUpdateStatus?.(null)}
                      className={cn(
                        "mt-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs outline-none transition",
                        !viewStatus ? "text-slate-600" : "hover:bg-slate-900/80 hover:text-slate-100"
                      )}
                    >
                      <XCircle size={16} />
                      Clear status
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-2 h-px bg-slate-800/60" />
                    <DropdownMenu.Item
                      disabled={statusPending}
                      onSelect={onRemove}
                      className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-rose-300 outline-none transition hover:bg-rose-500/10"
                    >
                      <Trash2 size={16} />
                      Remove from collection
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : null}
          </div>
          {readOnly ? (
            item.note ? (
              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-3 text-sm text-slate-200">
                {item.note}
              </div>
            ) : null
          ) : (
            <>
              <Textarea
                value={note}
                onChange={(event) => onNoteChange?.(event.target.value)}
                placeholder="Add a note or context for this placement"
              />
              <div className="flex justify-end">
                <Button variant="muted" size="sm" onClick={() => onSaveNote?.(note ?? "") }>
                  Save note
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
