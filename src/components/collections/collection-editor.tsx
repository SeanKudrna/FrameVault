"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
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
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MovieSearchModal } from "@/components/collections/movie-search-modal";
import {
  addMovieToCollectionAction,
  removeCollectionItemAction,
  reorderCollectionItemsAction,
  updateCollectionDetailsAction,
  updateCollectionItemNoteAction,
} from "@/app/(app)/collections/actions";
import type { CollectionItemWithMovie } from "@/types/collection";
import type { MovieSummary } from "@/lib/tmdb";
import type { Profile } from "@/lib/supabase/types";

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
  };
  profile: Profile;
  items: CollectionItemWithMovie[];
}

export function CollectionEditor({ collection, profile, items: initialItems }: CollectionEditorProps) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );
  const [items, setItems] = useState(() => initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragOriginItemsRef = useRef<CollectionItemWithMovie[]>(initialItems);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? "");
  const [isPublic, setIsPublic] = useState(collection.is_public);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
    dragOriginItemsRef.current = initialItems;
  }, [initialItems]);

  useEffect(() => {
    setTitle(collection.title);
    setDescription(collection.description ?? "");
    setIsPublic(collection.is_public);
  }, [collection.id, collection.title, collection.description, collection.is_public]);

  const existingTmdbIds = useMemo(() => items.map((item) => item.tmdb_id), [items]);
  const activeItem = useMemo(() => items.find((item) => item.id === activeId) ?? null, [items, activeId]);

  const handleAddMovie = useCallback((movie: MovieSummary) => {
    startTransition(async () => {
      try {
        await addMovieToCollectionAction({
          collectionId: collection.id,
          movie,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to add movie");
      }
    });
  }, [collection.id, router, startTransition]);

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

      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) {
          return currentItems;
        }

        const reordered = arrayMove(currentItems, oldIndex, newIndex).map((item, index) => ({
          ...item,
          position: index,
        }));

        startTransition(async () => {
          try {
            await reorderCollectionItemsAction({
              collectionId: collection.id,
              orderedIds: reordered.map((item) => ({ id: item.id, position: item.position })),
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reorder");
            setItems(dragOriginItemsRef.current.map((item) => ({ ...item })));
          }
        });

        return reordered;
      });
    },
    [collection.id, startTransition]
  );

  const handleSaveDetails = useCallback(() => {
    startTransition(async () => {
      try {
        await updateCollectionDetailsAction({
          collectionId: collection.id,
          title,
          description,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save details");
      }
    });
  }, [collection.id, description, router, startTransition, title]);

  const handleToggleVisibility = useCallback(() => {
    startTransition(async () => {
      try {
        await updateCollectionDetailsAction({
          collectionId: collection.id,
          isPublic: !isPublic,
        });
        setIsPublic((prev) => !prev);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update visibility");
      }
    });
  }, [collection.id, isPublic, router, startTransition]);

  const handleRemoveItem = useCallback((itemId: string) => {
    startTransition(async () => {
      try {
        await removeCollectionItemAction({
          collectionItemId: itemId,
          collectionId: collection.id,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to remove");
      }
    });
  }, [collection.id, router, startTransition]);

  const handleNoteSave = useCallback((itemId: string, note: string) => {
    startTransition(async () => {
      try {
        await updateCollectionItemNoteAction({
          collectionItemId: itemId,
          note,
          collectionId: collection.id,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save note");
      }
    });
  }, [collection.id, router, startTransition]);

  const shareUrl = (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') + `/c/${profile.username}/${collection.slug}`;

  return (
    <div className="space-y-10">
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
                onClick={() => navigator.clipboard.writeText(shareUrl)}
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
        >
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {items.map((item) => (
                <SortableMovieCard
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemoveItem(item.id)}
                  onSaveNote={(note) => handleNoteSave(item.id, note)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeItem ? <MovieCardOverlay item={activeItem} /> : null}
          </DragOverlay>
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

interface SortableMovieCardProps {
  item: CollectionItemWithMovie;
  onRemove: () => void;
  onSaveNote: (note: string) => void;
}

const SortableMovieCard = memo(function SortableMovieCard({ item, onRemove, onSaveNote }: SortableMovieCardProps) {
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

  useEffect(() => {
    setNote(item.note ?? "");
  }, [item.note]);

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
        dragHandleProps={{
          ...attributes,
          ...listeners,
        }}
      />
    </div>
  );
});
SortableMovieCard.displayName = "SortableMovieCard";


interface MovieCardBodyProps {
  item: CollectionItemWithMovie;
  note?: string;
  onNoteChange?: (value: string) => void;
  onRemove?: () => void;
  onSaveNote?: (note: string) => void;
  dragHandleProps?: Record<string, unknown>;
  readOnly?: boolean;
}

function MovieCardBody({
  item,
  note,
  onNoteChange,
  onRemove,
  onSaveNote,
  dragHandleProps,
  readOnly = false,
}: MovieCardBodyProps) {
  return (
    <div className="flex gap-4">
      {dragHandleProps ? (
        <button
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-800/70 bg-slate-900/60 text-slate-500"
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
          {item.movie?.posterUrl ? (
            <Image src={item.movie.posterUrl} alt={item.movie.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-800/60 text-xs text-slate-500">
              No art
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-100">{item.movie?.title ?? "Untitled"}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.movie?.releaseYear ?? ""}</p>
            </div>
            {!readOnly ? (
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <Trash2 size={16} />
              </Button>
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

function MovieCardOverlay({ item }: { item: CollectionItemWithMovie }) {
  return (
    <div className="pointer-events-none flex flex-col gap-4 rounded-3xl border border-indigo-400/40 bg-slate-950/90 p-5 shadow-[0_16px_60px_-30px_rgba(79,70,229,0.5)]">
      <MovieCardBody item={item} readOnly />
    </div>
  );
}
