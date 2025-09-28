"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Users, Sparkles, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followUserAction, unfollowUserAction } from "@/app/(app)/actions";
import { useToast } from "@/components/providers/toast-provider";

export interface DiscoverCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  updatedAt: string;
  coverImageUrl: string | null;
  itemCount: number;
  followerCount: number;
  badge: "popular" | "new" | null;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface DiscoverGridProps {
  collections: DiscoverCollection[];
  initialFollowedOwnerIds: string[];
  viewerId: string | null;
}

export function DiscoverGrid({ collections, initialFollowedOwnerIds, viewerId }: DiscoverGridProps) {
  const [followed, setFollowed] = useState(() => new Set(initialFollowedOwnerIds));
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleFollowToggle = (ownerId: string, isFollowing: boolean) => {
    if (!viewerId) {
      toast({
        title: "Sign in required",
        description: "Create an account to follow curators and collections.",
        variant: "info",
      });
      return;
    }

    setPendingOwnerId(ownerId);
    startTransition(async () => {
      try {
        if (isFollowing) {
          await unfollowUserAction(ownerId);
          setFollowed((next) => {
            const clone = new Set(next);
            clone.delete(ownerId);
            return clone;
          });
          toast({ title: "Unfollowed", description: "We’ll show fewer of their updates." });
        } else {
          await followUserAction(ownerId);
          setFollowed((next) => {
            const clone = new Set(next);
            clone.add(ownerId);
            return clone;
          });
          toast({ title: "Following", description: "Expect more of their collections in your feed." });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update follow status";
        toast({ title: "Action failed", description: message, variant: "error" });
      } finally {
        setPendingOwnerId(null);
      }
    });
  };

  const cards = useMemo(
    () =>
      collections.map((collection) => {
        const isFollowing = followed.has(collection.owner.id);
        const avatarInitials = (collection.owner.displayName ?? collection.owner.username)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("");
        const isSelfOwner = viewerId === collection.owner.id;
        return { collection, isFollowing, avatarInitials, isSelfOwner };
      }),
    [collections, followed, viewerId]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ collection, isFollowing, avatarInitials, isSelfOwner }) => (
        <article
          key={collection.id}
          className="flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 shadow-[0_18px_70px_-60px_rgba(15,23,42,0.8)]"
        >
          <Link href={`/c/${collection.owner.username}/${collection.slug}`} className="group space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/60">
              {collection.coverImageUrl ? (
                <Image
                  src={collection.coverImageUrl}
                  alt={collection.title}
                  width={640}
                  height={360}
                  className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                  No cover yet
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 text-sm font-semibold text-slate-200">
                  {avatarInitials || collection.owner.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    @{collection.owner.username}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-100">{collection.title}</h3>
                </div>
              </div>
              <p className="text-sm text-slate-400 line-clamp-3">{collection.description}</p>
            </div>
          </Link>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <Users size={14} />
              {collection.followerCount} followers
            </span>
            <span>{collection.itemCount} titles</span>
          </div>
          <div className="flex items-center justify-between">
            <Badge badge={collection.badge} updatedAt={collection.updatedAt} />
            {isSelfOwner ? (
              <span className="text-xs text-slate-500">This is you</span>
            ) : (
              <Button
                variant={isFollowing ? "muted" : "ghost"}
                size="sm"
                disabled={(isPending && pendingOwnerId === collection.owner.id) || isSelfOwner}
                onClick={() => handleFollowToggle(collection.owner.id, isFollowing)}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function Badge({ badge, updatedAt }: { badge: DiscoverCollection["badge"]; updatedAt: string }) {
  if (!badge) {
    const formatted = new Date(updatedAt).toLocaleDateString();
    return <span className="text-xs text-slate-500">Updated {formatted}</span>;
  }
  if (badge === "popular") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100">
        <Flame size={14} /> Popular
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
      <Sparkles size={14} /> New arrival
    </span>
  );
}
