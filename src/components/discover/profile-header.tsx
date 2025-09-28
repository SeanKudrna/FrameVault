"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followUserAction, unfollowUserAction } from "@/app/(app)/actions";
import { useToast } from "@/components/providers/toast-provider";

interface ProfileHeaderProps {
  ownerId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  isFollowing: boolean;
  viewerId: string | null;
}

export function ProfileHeader({
  ownerId,
  username,
  displayName,
  avatarUrl,
  followerCount: initialFollowerCount,
  isFollowing: initialIsFollowing,
  viewerId,
}: ProfileHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = () => {
    if (!viewerId) {
      toast({ title: "Sign in required", description: "Create an account to follow curators.", variant: "info" });
      return;
    }
    if (viewerId === ownerId) {
      toast({ title: "That’s you!", description: "Share your profile so others can follow it.", variant: "info" });
      return;
    }

    startTransition(async () => {
      try {
        if (isFollowing) {
          await unfollowUserAction(ownerId);
          setIsFollowing(false);
          setFollowerCount((count) => Math.max(0, count - 1));
          toast({ title: "Unfollowed", description: "We’ll show fewer of their updates." });
        } else {
          await followUserAction(ownerId);
          setIsFollowing(true);
          setFollowerCount((count) => count + 1);
          toast({ title: "Following", description: "Expect more of their collections in your feed." });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update follow status";
        toast({ title: "Action failed", description: message, variant: "error" });
      }
    });
  };

  const name = displayName ?? username;

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.8)] md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-800/60 bg-slate-900/70">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-200">
              {name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{name}</h1>
          <p className="text-sm text-slate-400">@{username}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Users size={14} /> {followerCount} follower{followerCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <Button variant={isFollowing ? "muted" : "default"} disabled={isPending} onClick={handleToggle}>
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </div>
  );
}
