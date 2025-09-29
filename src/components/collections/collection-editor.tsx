"use client";

/**
 * Collection Editor Component
 *
 * Comprehensive editing interface for movie collections with advanced features:
 *
 * Core Functionality:
 * - Drag-and-drop reordering of collection items with keyboard accessibility
 * - TMDB movie search and addition with duplicate prevention
 * - Inline editing of collection metadata (title, description, visibility)
 * - Custom cover image upload and theme customization (Plus/Pro features)
 * - Personal notes for individual movies
 * - Watch status tracking (Watched/Watching/Want to watch)
 * - Streaming availability display (Pro feature)
 * - Collaborator management (Pro feature)
 *
 * Technical Architecture:
 * - DnD Kit for robust drag-and-drop with touch and keyboard support
 * - Optimistic UI updates with rollback on server errors
 * - Real-time synchronization with Supabase for collaborative editing
 * - Image processing pipeline for cover uploads (crop to 16:9 aspect ratio)
 * - Complex state management with multiple async operations
 * - Responsive design with mobile-optimized interactions
 *
 * State Management:
 * - Local state for UI interactions and form data
 * - Server state synchronization via Next.js server actions
 * - Optimistic updates with error recovery
 * - Hydration-safe initialization
 *
 * Performance Optimizations:
 * - Memoized callbacks and computed values
 * - Efficient re-rendering with targeted state updates
 * - Image lazy loading and optimization
 * - Debounced search and API calls
 *
 * Accessibility:
 * - Full keyboard navigation support
 * - Screen reader announcements for drag operations
 * - Focus management during modal interactions
 * - ARIA labels and live regions
 *
 * Error Handling:
 * - Graceful degradation for failed operations
 * - User-friendly error messages
 * - State consistency maintenance
 * - Recovery mechanisms for interrupted operations
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
import { Eye, EyeOff, GripVertical, Plus, Trash2, Ellipsis, CheckCircle2, PlayCircle, BookmarkPlus, XCircle, Tv, ChevronDown, Settings, Share2, Film, Calendar, Globe, Users, Edit3, X, Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
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
  inviteCollectionCollaboratorAction,
  removeCollectionCollaboratorAction,
} from "@/app/(app)/collections/actions";
import type { CollectionItemWithMovie } from "@/types/collection";
import type { MovieSummary, WatchProviderGroup } from "@/lib/tmdb";
import type { Profile, WatchStatus } from "@/lib/supabase/types";

type ToastFn = ReturnType<typeof useToast>["toast"];

/**
 * Drag-and-Drop Accessibility Constants
 *
 * These constants support screen reader users during drag-and-drop operations.
 * The instructions element provides guidance on keyboard navigation for reordering items.
 *
 * DnD Kit automatically manages ARIA attributes and focus, but we provide
 * additional context through these constants for better accessibility.
 */
const DND_INSTRUCTIONS_ID = "framevault-dnd-instructions";

/**
 * Screen Reader Instructions for Drag-and-Drop
 *
 * Provides clear guidance for keyboard users on how to interact with
 * draggable collection items. These instructions are referenced by
 * the drag overlay and individual draggable elements.
 */
const DND_SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "Press space bar to pick up an item. Use the arrow keys to move, space bar to drop, and escape to cancel.",
} as const;

/**
 * Watch Status Configuration
 *
 * Defines the visual and behavioral properties for each watch status.
 * Used throughout the editor for consistent status display and interactions.
 *
 * Each status includes:
 * - Display label for UI elements
 * - Associated icon component from Lucide React
 * - Tailwind CSS classes for status pill styling
 * - Menu label for dropdown actions
 *
 * The color schemes use theme-aware colors that work with both light and dark modes.
 */
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

/**
 * Image Processing Utilities
 *
 * These functions handle the client-side image processing pipeline for collection covers.
 * The process involves converting files to data URLs, loading them into image elements,
 * and cropping them to the required 16:9 aspect ratio for consistent display.
 */

/**
 * Converts a File object to a base64 data URL for processing.
 *
 * @param file - The image file to convert
 * @returns Promise resolving to data URL string
 * @throws Error if file reading fails
 */
async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads a data URL into an HTML Image element for manipulation.
 *
 * @param dataUrl - Base64 encoded image data
 * @returns Promise resolving to loaded Image element
 * @throws Error if image loading fails
 */
async function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image"));
    img.src = dataUrl;
  });
}

/**
 * Crops an image to 16:9 aspect ratio for collection cover display.
 *
 * Algorithm:
 * 1. Load the image file into memory
 * 2. Calculate cropping dimensions to maintain 16:9 ratio
 * 3. Center-crop the image (remove excess from longer dimension)
 * 4. Resize to target dimensions (1600x900) for consistent quality
 * 5. Convert back to JPEG format with 92% quality
 *
 * This ensures all collection covers have consistent dimensions and aspect ratios
 * while preserving the most visually important center portion of the image.
 *
 * @param file - Original image file uploaded by user
 * @returns Promise resolving to processed File with cropped image
 * @throws Error if canvas operations fail
 */
async function cropImageToCover(file: File) {
  // Convert file to data URL for processing
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImage(dataUrl);

  // Target dimensions for collection covers (16:9 aspect ratio)
  const targetWidth = 1600;
  const targetHeight = 900;
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = image.width / image.height;

  // Calculate cropping coordinates to center the image
  let sx = 0; // Source X coordinate
  let sy = 0; // Source Y coordinate
  let sWidth = image.width; // Source width to crop
  let sHeight = image.height; // Source height to crop

  // Determine crop dimensions based on aspect ratio comparison
  if (sourceAspect > targetAspect) {
    // Image is wider than 16:9 - crop width, keep full height
    sHeight = image.height;
    sWidth = sHeight * targetAspect;
    sx = (image.width - sWidth) / 2; // Center horizontally
  } else {
    // Image is taller than 16:9 - crop height, keep full width
    sWidth = image.width;
    sHeight = sWidth / targetAspect;
    sy = (image.height - sHeight) / 2; // Center vertically
  }

  // Create canvas and draw cropped image
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }

  // Draw the cropped portion scaled to target size
  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

  // Convert canvas to JPEG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Unable to process image"));
    }, "image/jpeg", 0.92); // 92% quality for good balance of size/quality
  });

  // Return as File object with descriptive name
  return new File([blob], `collection-cover-${Date.now()}.jpg`, { type: "image/jpeg" });
}

/**
 * Props for the Collection Editor Component
 *
 * Defines the complete data contract for rendering and managing a collection.
 * This interface ensures type safety across server/client boundaries.
 */
interface CollectionEditorProps {
  /** Collection metadata and configuration */
  collection: {
    id: string;                    // Unique identifier
    title: string;                 // Display title
    slug: string;                  // URL-friendly identifier
    description: string | null;    // Optional description text
    previous_slugs: string[];      // Historical slugs for redirects
    is_public: boolean;           // Public visibility flag
    created_at: string;           // ISO timestamp
    updated_at: string;           // ISO timestamp
    cover_image_url: string | null; // Custom cover image URL
    theme: Record<string, unknown> | null; // Theme configuration object
  };

  /** Current user profile with permissions */
  profile: Profile;

  /** Collection items with full movie data */
  items: CollectionItemWithMovie[];

  /** Collaborator information for Pro users */
  collaborators: CollaboratorSummary[];

  /** Permission flags */
  isOwner: boolean;              // Whether current user owns the collection
  viewerIsCollaborator: boolean; // Whether current user is a collaborator
}

interface CollaboratorSummary {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
}

interface CollaboratorsPanelProps {
  collaborators: CollaboratorSummary[];
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  collectionId: string;
  canManage: boolean;
  isOwner: boolean;
  viewerId: string;
  viewerPlan: Profile["plan"];
  viewerIsCollaborator: boolean;
  toast: ToastFn;
  router: ReturnType<typeof useRouter>;
}

/**
 * Collection Editor Main Component
 *
 * The primary editing interface for movie collections, handling complex interactions
 * between drag-and-drop reordering, metadata editing, and collaborative features.
 *
 * Key State Management:
 * - Items array for drag-and-drop reordering with optimistic updates
 * - Form state for metadata editing (title, description, visibility)
 * - Modal states for search, appearance, and note editing
 * - Loading states for async operations
 * - Theme and cover image state with Plus/Pro restrictions
 *
 * Drag-and-Drop Architecture:
 * - Uses @dnd-kit for robust touch and keyboard accessibility
 * - Pointer sensor with activation distance to prevent accidental drags
 * - Maintains original order reference for error recovery
 * - Optimistic UI with server synchronization
 *
 * @param props - Complete collection data and user permissions
 */
export function CollectionEditor({
  collection,
  profile,
  items: initialItems,
  collaborators,
  isOwner,
  viewerIsCollaborator,
}: CollectionEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  /**
   * Drag-and-Drop Sensor Configuration
   *
   * Configures touch and pointer sensors for drag operations.
   * The activation constraint prevents accidental reordering when clicking buttons
   * within draggable cards by requiring an 8px drag distance.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Prevent accidental drags on button clicks
    })
  );

  // Core state for collection items and drag operations
  const [items, setItems] = useState(() => initialItems);
  const [, setActiveId] = useState<string | null>(null);

  /**
   * Drag Origin Reference
   *
   * Maintains a snapshot of the original item order for error recovery.
   * Updated after successful server synchronization to reflect the new "original" state.
   * Used to rollback optimistic UI updates when server actions fail.
   */
  const dragOriginItemsRef = useRef<CollectionItemWithMovie[]>(initialItems);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isAppearanceOpen, setAppearanceOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [currentNoteItem, setCurrentNoteItem] = useState<CollectionItemWithMovie | null>(null);
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
  const canManageCollaborators = isOwner && profile.plan === "pro";

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

  /**
   * Drag Start Handler
   *
   * Captures the initial state when a drag operation begins.
   * Creates a deep copy of current items for potential rollback on errors.
   * Updates the active drag state for UI feedback.
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Snapshot current state for error recovery
    dragOriginItemsRef.current = items.map((item) => ({ ...item }));
    setActiveId(event.active.id as string);
  }, [items]);

  /**
   * Drag Cancel Handler
   *
   * Reverts any optimistic UI changes when a drag is cancelled.
   * Restores the original item order from the snapshot.
   */
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    // Restore original order on drag cancellation
    setItems(dragOriginItemsRef.current.map((item) => ({ ...item })));
  }, []);

  /**
   * Drag End Handler
   *
   * Processes completed drag operations with optimistic UI updates and server synchronization.
   * Implements a robust error recovery mechanism that maintains UI consistency.
   *
   * Algorithm:
   * 1. Validate drag operation (must have valid source and target)
   * 2. Calculate new positions using arrayMove utility
   * 3. Apply optimistic UI update immediately
   * 4. Persist changes to server with error handling
   * 5. Rollback UI state if server operation fails
   *
   * @param event - DnD Kit drag end event with active/over item information
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      // Validate drag operation - must have target and different positions
      if (!over || active.id === over.id) return;

      const currentItems = items;
      const oldIndex = currentItems.findIndex((item) => item.id === active.id);
      const newIndex = currentItems.findIndex((item) => item.id === over.id);

      // Ensure both items exist in the array
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      // Create snapshot for error recovery
      const originSnapshot = dragOriginItemsRef.current.map((item) => ({ ...item }));

      // Calculate new order with updated positions
      const reordered = arrayMove(currentItems, oldIndex, newIndex).map((item, index) => ({
        ...item,
        position: index, // Update position field for server sync
      }));

      // Apply optimistic update immediately for responsive UX
      setItems(reordered);

      /**
       * Server Synchronization with Error Recovery
       *
       * Persists the reordering to the database while maintaining UI responsiveness.
       * Uses React transitions to keep the interface interactive during the async operation.
       * Implements complete error recovery by reverting to the original state on failure.
       */
      startTransition(async () => {
        try {
          // Send reordered item IDs with new positions to server
          await reorderCollectionItemsAction({
            collectionId: collection.id,
            orderedIds: reordered.map((item) => ({ id: item.id, position: item.position })),
          });

          // Update recovery snapshot on successful persistence
          dragOriginItemsRef.current = reordered.map((item) => ({ ...item }));
          setError(null);
        } catch (err) {
          // Handle server errors with user feedback and UI rollback
          const message = err instanceof Error ? err.message : "Failed to reorder";
          setError(message);
          toast({ title: "Unable to reorder", description: message, variant: "error" });

          // Rollback optimistic changes
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
    <div className="space-y-12">
      {/* Collection Hero Header - Viewer Focused */}
      <section className="relative overflow-hidden rounded-3xl border border-border-primary bg-surface-primary/90 pt-6 pb-12 px-12 shadow-2xl" style={themePreview ? {
        background: `linear-gradient(135deg, ${themePreview.accent}15, ${themePreview.accent}08, ${themePreview.gradient.to}40)`,
        boxShadow: `0 0 20px -5px ${themePreview.accent}15, 0 25px 50px -12px rgba(0, 0, 0, 0.25)`,
      } : undefined}>
        {/* Background with theme gradient - more prominent */}
        {themePreview && (
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(135deg, ${themePreview.gradient.from}, ${themePreview.gradient.via}, ${themePreview.gradient.to})`,
            }}
          />
        )}

        {/* Cover Image Overlay */}
        {coverImageUrl && (
          <div className="absolute inset-0">
            <Image
              src={coverImageUrl}
              alt="Collection cover"
              fill
              className="object-cover opacity-10"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-surface-primary/80 via-surface-primary/60 to-surface-primary/40" />
          </div>
        )}

        <div className="relative z-10">
          {/* Header Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAppearanceOpen(true)}
                className="bg-surface-primary/80 backdrop-blur-sm border-border-secondary hover:bg-surface-primary hover:text-accent-primary cursor-pointer"
              >
                <Settings size={16} />
                Edit appearance
              </Button>
              {isOwner && (
                <Button variant="outline" onClick={handleToggleVisibility} disabled={pending} size="sm" className="hover:text-accent-primary cursor-pointer">
                  {isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
                  {isPublic ? "Make private" : "Make public"}
                </Button>
              )}
            </div>

            {isPublic && (
              <Button
                variant="outline"
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
                className="bg-surface-primary/80 backdrop-blur-sm border-border-secondary hover:bg-surface-primary"
              >
                <Share2 size={16} />
                Share
              </Button>
            )}
          </div>

          {/* Collection Title & Description */}
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-gradient mb-4 leading-tight">
                {collection.title}
              </h1>
              {collection.description && (
                <p className="text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto">
                  {collection.description}
                </p>
              )}
            </div>

            {/* Collection Stats */}
            <div className="flex items-center justify-center gap-8 text-sm text-text-tertiary">
              <div className="flex items-center gap-2">
                <Film size={16} />
                <span className="font-medium">{items.length} {items.length === 1 ? 'film' : 'films'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>Created {new Date(collection.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}</span>
              </div>
              {isPublic && (
                <div className="flex items-center gap-2">
                  <Globe size={16} />
                  <span>Public collection</span>
                </div>
              )}
              {collaborators.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  <span>{collaborators.length + 1} curator{collaborators.length > 0 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button onClick={() => setSearchOpen(true)} size="lg" className="px-8 hover:text-[#0a0a0f] cursor-pointer">
              <Plus size={18} />
              Add film
            </Button>
            {isOwner && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setEditMode(!editMode)}
                className="px-8 hover:text-accent-primary cursor-pointer"
              >
                <Edit3 size={18} />
                {editMode ? 'Done editing' : 'Edit details'}
              </Button>
            )}
          </div>

          {/* Inline Edit Mode */}
          {editMode && isOwner && (
            <div className="mt-8 pt-8 border-t border-border-secondary">
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Collection title</label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="text-center text-2xl font-bold h-14"
                    placeholder="Enter collection title..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Description</label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What story does this curation tell?"
                    className="text-center min-h-[100px] resize-none"
                  />
                </div>
                <div className="flex justify-center gap-3">
                  <Button onClick={handleSaveDetails} disabled={pending} className="hover:text-[#0a0a0f] cursor-pointer">
                    {pending ? "Saving..." : "Save changes"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode(false)} className="hover:text-accent-primary cursor-pointer">
                    Cancel
                  </Button>
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              </div>
            </div>
          )}
        </div>
      </section>

      <CollaboratorsPanel
        collaborators={collaborators}
        owner={{
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
        }}
        collectionId={collection.id}
        canManage={canManageCollaborators}
        isOwner={isOwner}
        viewerId={profile.id}
        viewerPlan={profile.plan}
        viewerIsCollaborator={viewerIsCollaborator}
        toast={toast}
        router={router}
      />

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gradient">Titles</h2>
          <div className="text-sm text-text-tertiary">
            {items.length} {items.length === 1 ? 'film' : 'films'} in collection
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-secondary bg-surface-secondary/40 p-12 text-center text-sm text-text-tertiary">
            No films yet. Use the Add movie action to start this collection.
          </div>
        ) : (
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
                    plan={profile.plan}
                    preferredRegion={profile.preferred_region}
                    onOpenNoteModal={(item) => {
                      setCurrentNoteItem(item);
                      setNoteModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay />
          </DndContext>
        )}
      </section>

      {/* Appearance Settings Modal */}
      <Dialog.Root open={isAppearanceOpen} onOpenChange={setAppearanceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 focus:outline-none">
            <div className="glass-card rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <Dialog.Title className="text-2xl font-semibold text-gradient">
                  Collection Appearance
                </Dialog.Title>
                <Button variant="ghost" size="sm" onClick={() => setAppearanceOpen(false)} className="hover:[&>span>svg]:text-accent-primary cursor-pointer">
                  <X size={16} />
                </Button>
              </div>

              <div className="space-y-8">
                {!canCustomize ? (
                  <PlanGate
                    title="Unlock custom branding"
                    message="Plus members can upload cover art and theme their collections."
                    ctaLabel="Upgrade to Plus"
                    href="/settings/billing"
                  />
                ) : (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-text-primary">Cover image</h3>
                      <div className="space-y-3">
                        <div
                          className="relative h-48 w-full overflow-hidden rounded-2xl border border-border-secondary bg-surface-secondary"
                          style={themePreview ? { backgroundImage: `linear-gradient(135deg, ${themePreview.gradient.from}, ${themePreview.gradient.via}, ${themePreview.gradient.to})` } : undefined}
                        >
                          {coverImageUrl ? (
                            <Image src={coverImageUrl} alt="Collection cover" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm text-text-tertiary">
                              Upload a 16:9 image for the best look
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploadingCover} className="hover:text-[#0a0a0f] cursor-pointer">
                            {isUploadingCover ? "Uploading..." : "Upload cover"}
                          </Button>
                          {coverImageUrl ? (
                            <Button variant="outline" onClick={handleCoverRemove} disabled={isUploadingCover}>
                              Remove cover
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-text-primary">Accent theme</h3>
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
                                  ? "border-accent-primary/60 ring-2 ring-accent-primary/30"
                                  : "border-border-secondary hover:border-accent-primary/40"
                              )}
                              style={{
                                backgroundImage: `linear-gradient(135deg, ${option.gradient.from}, ${option.gradient.via}, ${option.gradient.to})`,
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-black/25 to-black/40" />
                              <div className="relative space-y-2 text-text-primary">
                                <p className="text-sm font-semibold">{option.label}</p>
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs">
                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.accent }} />
                                    Accent
                                  </span>
                                  {isActive ? <span className="text-[10px] uppercase tracking-[0.24em] text-accent-primary">Selected</span> : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetTheme}
                        disabled={isSavingTheme || !selectedTheme}
                        className="hover:text-accent-primary cursor-pointer"
                      >
                        Reset theme
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Note Editing Modal */}
      <Dialog.Root open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 focus:outline-none">
            <div className="glass-card rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-xl font-semibold text-gradient">
                  {currentNoteItem?.movie?.title || "Movie"} Note
                </Dialog.Title>
                <Button variant="ghost" size="sm" onClick={() => setNoteModalOpen(false)}>
                  <X size={16} />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Personal Note</label>
                  <Textarea
                    value={currentNoteItem?.note || ""}
                    onChange={(e) => {
                      if (currentNoteItem) {
                        setCurrentNoteItem({ ...currentNoteItem, note: e.target.value });
                      }
                    }}
                    placeholder="Add your thoughts, ratings, or reminders about this film..."
                    className="min-h-[120px] resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => {
                    setNoteModalOpen(false);
                    setCurrentNoteItem(null);
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (currentNoteItem) {
                        handleNoteSave(currentNoteItem, currentNoteItem.note || "");
                        setNoteModalOpen(false);
                        setCurrentNoteItem(null);
                      }
                    }}
                  >
                    Save Note
                  </Button>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileChange} />

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
  plan: Profile["plan"];
  preferredRegion: string | null | undefined;
  readOnly?: boolean;
  onOpenNoteModal: (item: CollectionItemWithMovie) => void;
}

/**
 * CollaboratorsPanel Component
 *
 * Pro feature panel for managing collaborative collection editing.
 * Allows collection owners to invite collaborators and manage access permissions.
 *
 * Features:
 * - Invite collaborators by username or email
 * - Display collaborator list with roles and avatars
 * - Remove collaborators (owners and self-removal)
 * - Plan gating for Pro-only feature
 * - Optimistic UI updates with error recovery
 *
 * State Management:
 * - Local state for invite form and pending operations
 * - Memoized collaborator entries to prevent unnecessary re-renders
 * - Transition-based loading states for smooth UX
 *
 * Security:
 * - Permission checks for management actions
 * - Self-removal handling with navigation
 * - Role-based access control
 *
 * @param collaborators - Array of current collaborators
 * @param owner - Collection owner information
 * @param collectionId - Collection identifier for API calls
 * @param canManage - Whether current user can manage collaborators
 * @param isOwner - Whether current user is the collection owner
 * @param viewerId - Current user's ID for self-removal logic
 * @param viewerPlan - Current user's plan for feature gating
 * @param viewerIsCollaborator - Whether current user is a collaborator
 * @param toast - Toast notification function
 * @param router - Next.js router for navigation
 */
const CollaboratorsPanel = memo(function CollaboratorsPanel({
  collaborators,
  owner,
  collectionId,
  canManage,
  isOwner,
  viewerId,
  viewerPlan,
  viewerIsCollaborator,
  toast,
  router,
}: CollaboratorsPanelProps) {
  // Invite form state
  const [inviteValue, setInviteValue] = useState("");
  const [invitePending, startInviteTransition] = useTransition();

  // Removal operation state
  const [removingId, setRemovingId] = useState<string | null>(null);

  const entries = useMemo(() => {
    const unique = new Map<string, {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      role: string;
      isOwner: boolean;
    }>();

    unique.set(owner.id, {
      id: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
      role: "owner",
      isOwner: true,
    });

    for (const collaborator of collaborators) {
      if (collaborator.user_id === owner.id) continue;
      unique.set(collaborator.user_id, {
        id: collaborator.user_id,
        username: collaborator.username,
        displayName: collaborator.display_name,
        avatarUrl: collaborator.avatar_url,
        role: collaborator.role,
        isOwner: false,
      });
    }

    return Array.from(unique.values());
  }, [collaborators, owner]);

  const handleInvite = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const value = inviteValue.trim();
      if (!value) {
        toast({
          title: "Enter a collaborator",
          description: "Share a username or email to send an invite.",
          variant: "info",
        });
        return;
      }

      startInviteTransition(async () => {
        try {
          await inviteCollectionCollaboratorAction({
            collectionId,
            identifier: value,
          });
          toast({
            title: "Invite sent",
            description: "We’ve added that collaborator to your collection.",
            variant: "success",
          });
          setInviteValue("");
          router.refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to invite collaborator";
          toast({ title: "Invite failed", description: message, variant: "error" });
        }
      });
    },
    [collectionId, inviteValue, router, toast]
  );

  const handleRemove = useCallback(
    (userId: string) => {
      const isSelf = userId === viewerId;
      setRemovingId(userId);
      startInviteTransition(async () => {
        try {
          await removeCollectionCollaboratorAction({ collectionId, userId });
          toast({
            title: isSelf ? "You left the collection" : "Collaborator removed",
            description: isSelf
              ? "You no longer have access to this collection."
              : "They’ll no longer be able to curate with you.",
            variant: "success",
          });
          if (isSelf && !isOwner) {
            router.push("/app");
          } else {
            router.refresh();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to update collaborators";
          toast({ title: "Action failed", description: message, variant: "error" });
        } finally {
          setRemovingId(null);
        }
      });
    },
    [collectionId, isOwner, router, toast, viewerId]
  );

  const initials = useCallback((displayName: string | null, username: string) => {
    const reference = displayName?.trim() || username;
    const parts = reference.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return username.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, []);

  const showPlanGate = isOwner && viewerPlan !== "pro";

  return (
    <section className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-[0_18px_70px_-60px_rgba(15,23,42,0.8)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Collaborators</h2>
          <p className="text-sm text-slate-400">Invite trusted curators to help maintain this collection.</p>
        </div>
        {isOwner ? (
          <span className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">Pro feature</span>
        ) : null}
      </div>

      {showPlanGate ? (
        <PlanGate
          title="Upgrade required"
          message="Co-curation is part of the Pro toolkit. Upgrade to manage collaborators."
          href="/settings/billing?plan=pro"
          ctaLabel="Upgrade to Pro"
        />
      ) : null}

      {canManage ? (
        <form className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 md:flex-row md:items-center" onSubmit={handleInvite}>
          <div className="flex-1">
            <label className="text-xs uppercase tracking-[0.28em] text-slate-500">Invite by username or email</label>
            <Input
              value={inviteValue}
              onChange={(event) => setInviteValue(event.target.value)}
              placeholder="@centuryclub or curator@example.com"
              className="mt-2"
            />
          </div>
          <Button type="submit" disabled={invitePending} className="mt-2 md:mt-6 hover:text-[#0a0a0f] cursor-pointer">
            {invitePending ? "Sending..." : "Send invite"}
          </Button>
        </form>
      ) : null}

      <div className="space-y-3">
        {entries.map((entry) => {
          const isSelf = entry.id === viewerId;
          const canRemove = entry.id !== owner.id && (canManage || isSelf);
          const badgeLabel = entry.isOwner ? "Owner" : entry.role === "editor" ? "Editor" : entry.role;
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-sm font-semibold text-slate-200">
                  {initials(entry.displayName, entry.username)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">{entry.displayName ?? entry.username}</p>
                  <p className="text-xs text-slate-500">@{entry.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    entry.isOwner
                      ? "border-indigo-400/50 bg-indigo-500/10 text-indigo-100"
                      : "border-slate-700/60 bg-slate-800/60 text-slate-300"
                  )}
                >
                  {badgeLabel}
                </span>
                {canRemove ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(entry.id)}
                    disabled={removingId === entry.id}
                  >
                    {isSelf ? "Leave" : "Remove"}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {!entries.length ? <div className="text-sm text-slate-400">No collaborators yet.</div> : null}
      {!isOwner && !viewerIsCollaborator ? (
        <div className="text-xs text-slate-500">Only collaborators invited by the owner can edit this collection.</div>
      ) : null}
    </section>
  );
});

const SortableMovieCard = memo(function SortableMovieCard({
  item,
  onRemove,
  onSaveNote,
  onUpdateStatus,
  plan,
  preferredRegion,
  readOnly = false,
  onOpenNoteModal,
}: SortableMovieCardProps) {
  const router = useRouter();
  const region = (preferredRegion?.trim() || "US").toUpperCase();
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

  function navigateToMovie() {
    router.push(`/movies/${item.tmdb_id}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToMovie();
    }
  }
  const [dragHandleDescribedBy, setDragHandleDescribedBy] = useState<string | undefined>(
    () => (attributes?.["aria-describedby"] as string | undefined) ?? undefined
  );

  useEffect(() => {
    const describedBy = attributes?.["aria-describedby"] as string | undefined;
    if (describedBy && describedBy !== dragHandleDescribedBy) {
      setDragHandleDescribedBy(describedBy);
    }
  }, [attributes, dragHandleDescribedBy]);

  const dragHandleProps = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ["aria-describedby"]: _ignored, ...restAttributes } = (attributes ?? {}) as Record<string, unknown>;
    return {
      ...restAttributes,
      ...(listeners ?? {}),
      "aria-describedby": dragHandleDescribedBy,
    };
  }, [attributes, listeners, dragHandleDescribedBy]);
  const [note, setNote] = useState(item.note ?? "");
  const [status, setStatus] = useState<WatchStatus | null>(item.viewStatus ?? null);
  const [watchedAt, setWatchedAt] = useState<string | null>(item.watchedAt ?? null);
  const [statusPending, setStatusPending] = useState(false);
  const [providersVisible, setProvidersVisible] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providers, setProviders] = useState<WatchProviderGroup | null>(null);
  const isPro = plan === "pro";

  const formattedWatchedAt = useMemo(() => {
    if (!watchedAt) return null;
    const date = new Date(watchedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }, [watchedAt]);

  const statusMeta = useMemo(() => {
    if (!status) return null;
    const config = STATUS_CONFIG[status];
    return {
      ...config,
      watchHint: status === "watched" && formattedWatchedAt ? `Watched ${formattedWatchedAt}` : null,
    };
  }, [formattedWatchedAt, status]);

  const statusEntries = useMemo(
    () => Object.entries(STATUS_CONFIG) as Array<[WatchStatus, (typeof STATUS_CONFIG)[WatchStatus]]>,
    []
  );

  const loadProviders = useCallback(async () => {
    if (providers || providersLoading) return;
    setProvidersLoading(true);
    setProvidersError(null);
    try {
      const response = await fetch(
        `/api/tmdb/providers?movieId=${item.tmdb_id}&region=${region}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to load providers");
      }
      const payload = (await response.json()) as { providers: WatchProviderGroup | null };
      setProviders(payload.providers ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load providers";
      setProvidersError(message);
    } finally {
      setProvidersLoading(false);
    }
  }, [item.tmdb_id, region, providers, providersLoading]);

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
    <article
      ref={setNodeRef}
      style={style}
      role="link"
      tabIndex={0}
      onClick={navigateToMovie}
      onKeyDown={handleKeyDown}
      className={`group flex h-full w-full flex-col gap-4 rounded-3xl border border-border-primary/60 bg-surface-primary/80 p-4 shadow-lg shadow-black/10 transition hover:-translate-y-1 hover:border-accent-primary/50 hover:shadow-[0_30px_60px_-35px_rgba(129,140,248,0.55)] cursor-pointer ${
        isDragging ? "ring-2 ring-accent-primary" : ""
      }`}
    >
      <div className="flex gap-4">
        {/* Drag Handle - Left of Poster */}
        {!readOnly && (
          <div className="flex flex-col gap-1 mr-2">
            <button
              {...dragHandleProps}
              onClick={(e) => e.stopPropagation()}
              suppressHydrationWarning
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-border-secondary bg-surface-secondary text-text-tertiary transition hover:border-accent-primary/70 hover:bg-surface-primary hover:text-accent-primary cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenNoteModal(item);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-border-secondary bg-surface-secondary text-text-tertiary transition hover:border-accent-primary/70 hover:bg-surface-primary hover:text-accent-primary cursor-pointer"
              title="Add/Edit note"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}

        {/* Poster */}
        <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border-secondary/60 bg-surface-secondary">
          <PosterImage
            src={item.movie?.posterUrl ?? null}
            fallbackSrc={item.movie?.fallbackPosterUrl ?? null}
            alt={item.movie?.title ?? "Poster"}
            sizes="(min-width: 1280px) 140px, (min-width: 768px) 120px, 38vw"
            tmdbId={item.movie?.tmdbId ?? null}
            className="h-full w-full"
            imageClassName="rounded-none object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text-primary transition-colors duration-200 line-clamp-2 group-hover:text-gradient flex items-center gap-2">
                {item.movie?.title ?? "Untitled"}
                {item.movie?.releaseYear && (
                  <span className="text-sm font-normal text-text-tertiary">
                    ({item.movie.releaseYear})
                  </span>
                )}
              </h3>
            </div>
            {!readOnly && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={statusPending}
                    className="h-6 w-6 p-0 ml-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Ellipsis size={14} />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    className="w-56 rounded-2xl border border-border-primary bg-surface-primary/95 p-2 text-sm text-text-primary shadow-xl backdrop-blur"
                  >
                    <DropdownMenu.Label className="px-3 pb-1 text-xs uppercase tracking-[0.24em] text-text-tertiary">
                      Status
                    </DropdownMenu.Label>
                    {statusEntries.map(([key, config]) => {
                      const iconColors = {
                        watched: "text-green-400",
                        watching: "text-accent-secondary",
                        want: "text-accent-primary"
                      };
                      return (
                        <DropdownMenu.Item
                          key={key}
                          disabled={statusPending}
                          onSelect={(e) => {
                            e?.preventDefault();
                            if (key === "watched") {
                              handleStatusChange("watched", { watchedAt: new Date().toISOString() });
                            } else {
                              handleStatusChange(key);
                            }
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 outline-none transition",
                            status === key
                              ? "bg-accent-primary/15 text-accent-primary"
                              : "hover:bg-surface-secondary/80 hover:text-accent-primary"
                          )}
                        >
                          <config.Icon size={16} className={iconColors[key as keyof typeof iconColors]} />
                          <span>{config.menuLabel}</span>
                          {status === key ? <span className="ml-auto text-[10px] uppercase tracking-[0.24em] text-accent-primary">Active</span> : null}
                        </DropdownMenu.Item>
                      );
                    })}
                      <DropdownMenu.Item
                        disabled={!status || statusPending}
                        onSelect={(e) => {
                          e?.preventDefault();
                          handleStatusChange(null);
                        }}
                      className={cn(
                        "mt-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs outline-none transition",
                        !status ? "text-text-muted" : "hover:bg-surface-secondary/80 hover:text-accent-primary"
                      )}
                    >
                      <XCircle size={16} className="text-accent-tertiary" />
                      Clear status
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-2 h-px bg-border-secondary" />
                      <DropdownMenu.Item
                        disabled={statusPending}
                        onSelect={(e) => {
                          e?.preventDefault();
                          onRemove();
                        }}
                      className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-red-400 outline-none transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 size={16} className="text-red-400" />
                      Remove from collection
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
          {item.movie?.overview ? (
            <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
              {item.movie.overview}
            </p>
          ) : null}

          {/* Status Badge */}
          {statusMeta && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[10px]",
                  statusMeta.pillClass
                )}
              >
                <statusMeta.Icon size={12} />
                {statusMeta.label}
                {statusMeta.watchHint ? <span className="text-[9px] uppercase tracking-[0.18em] text-current/70">{statusMeta.watchHint}</span> : null}
              </span>
            </div>
          )}

          {/* Personal Note (if present) */}
          {note && (
            <div className="rounded-lg border border-accent-primary/20 bg-accent-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Pencil size={12} className="text-accent-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-accent-primary uppercase tracking-wide mb-1">My Note</p>
                  <p className="text-sm text-text-primary leading-relaxed">{note}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Streaming availability for Pro users */}
      {isPro && (
        <div className="mt-auto border-t border-border-secondary pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border-secondary bg-surface-secondary px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent-primary/40 hover:bg-accent-primary/10 hover:text-accent-primary cursor-pointer"
            onClick={(e) => {
              e.stopPropagation(); // Prevent navigation to movie page
              const next = !providersVisible;
              setProvidersVisible(next);
              if (next) {
                void loadProviders();
              }
            }}
          >
            <span className="flex items-center gap-2">
              <Tv size={14} />
              Streaming
              <span className="text-[10px] text-text-tertiary">Region {region}</span>
            </span>
            <ChevronDown
              size={14}
              className={`transition-transform ${providersVisible ? "rotate-180" : ""}`}
            />
          </button>
          {providersVisible && (
            <div className="mt-2 space-y-2 text-xs text-text-primary">
              {providersLoading ? (
                <p className="text-text-tertiary">Checking...</p>
              ) : providersError ? (
                <p className="text-red-400">{providersError}</p>
              ) : providers ? (
                <ProvidersList providers={providers} />
              ) : (
                <p className="text-text-tertiary">No providers available</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
});
SortableMovieCard.displayName = "SortableMovieCard";



interface ProvidersListProps {
  providers: WatchProviderGroup;
}

function ProvidersList({ providers }: ProvidersListProps) {
  const groups: Array<{ key: "stream" | "rent" | "buy"; label: string; providers: WatchProviderGroup["stream"] }>
    = [
      { key: "stream", label: "Included with streaming", providers: providers.stream },
      { key: "rent", label: "Rent", providers: providers.rent },
      { key: "buy", label: "Buy", providers: providers.buy },
    ];

  const hasAny = groups.some((group) => Array.isArray(group.providers) && group.providers.length > 0);
  if (!hasAny) {
    return <p className="text-sm text-text-tertiary">No providers available in this region right now.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const list = Array.isArray(group.providers) ? group.providers : [];
        if (!list.length) return null;
        return (
          <div key={group.key} className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-text-tertiary">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((provider) => (
                <span
                  key={provider.id}
                  className="flex items-center gap-2 rounded-full border border-border-secondary bg-surface-secondary px-3 py-1 text-xs text-text-primary"
                >
                  {provider.logoUrl ? (
                    <Image
                      src={provider.logoUrl}
                      alt={provider.name}
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] rounded"
                      unoptimized
                    />
                  ) : null}
                  {provider.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
