"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, ListPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/app/(app)/settings/actions";
import { createStarterCollectionAction, updateOnboardingStateAction } from "@/app/(app)/app/onboarding/actions";
import type { OnboardingState, Profile } from "@/lib/supabase/types";
import { useToast } from "@/components/providers/toast-provider";

interface OnboardingFlowProps {
  profile: Pick<Profile, "id" | "username" | "display_name" | "preferred_region">;
  initialState: OnboardingState;
  totalItems: number;
  initialCollections: OnboardingCollection[];
}

interface OnboardingCollection {
  id: string;
  title: string;
  createdAt: string;
  itemCount: number;
}

export function OnboardingFlow({ profile, initialState, totalItems, initialCollections }: OnboardingFlowProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [profilePending, startProfileTransition] = useTransition();
  const [starterPending, startStarterTransition] = useTransition();
  const [completionPending, startCompletionTransition] = useTransition();
  const [collections, setCollections] = useState(initialCollections);

  const moviesRemaining = Math.max(0, 5 - totalItems);
  const moviesStepComplete = state.addedFiveMovies || moviesRemaining <= 0;
  const allComplete = state.completed || (state.claimedProfile && state.createdFirstCollection && moviesStepComplete);

  const primaryCollection = useMemo(() => {
    if (collections.length === 0) return null;
    return collections.reduce<OnboardingCollection | null>((chosen, candidate) => {
      if (!chosen) return candidate;
      if (candidate.itemCount < chosen.itemCount) return candidate;
      if (candidate.itemCount === chosen.itemCount) {
        const candidateTime = new Date(candidate.createdAt).getTime();
        const chosenTime = new Date(chosen.createdAt).getTime();
        return candidateTime > chosenTime ? candidate : chosen;
      }
      return chosen;
    }, null);
  }, [collections]);

  const primaryCollectionPath = primaryCollection ? `/app/collections/${primaryCollection.id}` : null;

  const handleProfileSubmit = () => {
    startProfileTransition(async () => {
      try {
        await updateProfileAction({ username, displayName });
        const next = await updateOnboardingStateAction({ claimedProfile: true });
        setState(next);
        toast({ title: "Profile saved", description: "Great — your public persona is ready." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update profile";
        toast({ title: "Save failed", description: message, variant: "error" });
      }
    });
  };

  const handleStarterCollection = () => {
    startStarterTransition(async () => {
      try {
        const result = await createStarterCollectionAction();
        setState(result.onboardingState);
        setCollections((previous) => {
          const exists = previous.some((collection) => collection.id === result.collection.id);
          if (exists) {
            return previous.map((collection) =>
              collection.id === result.collection.id
                ? {
                    id: collection.id,
                    title: result.collection.title ?? collection.title,
                    createdAt: result.collection.created_at ?? collection.createdAt,
                    itemCount: collection.itemCount,
                  }
                : collection
            );
          }
          return [
            ...previous,
            {
              id: result.collection.id,
              title: result.collection.title ?? "Starter collection",
              createdAt: result.collection.created_at ?? new Date().toISOString(),
              itemCount: 0,
            },
          ];
        });
        toast({
          title: "Starter shelf created",
          description: "Head to your dashboard to start curating!",
          variant: "success",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create starter collection";
        toast({ title: "Action failed", description: message, variant: "error" });
      }
    });
  };

  const handleSkipForNow = () => {
    startCompletionTransition(async () => {
      try {
        const next = await updateOnboardingStateAction({ completed: true });
        setState(next);
        toast({
          title: "Onboarding complete",
          description: "You can always add more films from your dashboard.",
          variant: "success",
        });
        router.push("/app");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to finish onboarding";
        toast({ title: "Skip failed", description: message, variant: "error" });
      }
    });
  };

  const upcomingStep = useMemo(() => {
    if (!state.claimedProfile) return 1;
    if (!state.createdFirstCollection) return 2;
    if (!moviesStepComplete) return 3;
    return 4;
  }, [state, moviesStepComplete]);

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-slate-100">Let’s get your FrameVault ready</h1>
        <p className="text-sm text-slate-400">Follow these quick steps to make your collections shine.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        {!state.claimedProfile ? (
          <StepCard
            title="Claim your profile"
            description="Pick a username and display name — this powers your public URL and credits."
            completed={state.claimedProfile}
            icon={<Sparkles size={18} />}
            status={upcomingStep > 1 ? "done" : "active"}
          >
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Username</label>
                <Input value={username} onChange={(event) => setUsername(event.target.value)} disabled={profilePending} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Display name</label>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={profilePending} />
              </div>
              <Button onClick={handleProfileSubmit} disabled={profilePending || !username.trim()}>
                {profilePending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
              </Button>
            </div>
          </StepCard>
        ) : null}

        {!state.createdFirstCollection ? (
          <StepCard
            title="Spin up a starter shelf"
            description="We’ll drop in a blank collection with a cozy template so you can start curating."
            completed={state.createdFirstCollection}
            icon={<ListPlus size={18} />}
            status={upcomingStep > 2 ? "done" : upcomingStep === 2 ? "active" : "pending"}
          >
            <Button onClick={handleStarterCollection} disabled={starterPending}>
              {starterPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create template"}
            </Button>
            {state.createdFirstCollection ? (
              <p className="text-xs text-emerald-300">Starter collection ready. Add a few titles to make it yours.</p>
            ) : null}
          </StepCard>
        ) : null}

        {!state.completed ? (
          <StepCard
            title="Add five films"
            description="Search TMDB from your dashboard and drop in at least five favourites."
            completed={moviesStepComplete}
            icon={<CheckCircle2 size={18} />}
            status={moviesStepComplete ? "done" : upcomingStep === 3 ? "active" : "pending"}
          >
            <p className="text-sm text-slate-400">
              {moviesStepComplete
                ? "Nice! You’ve logged enough films to give Smart Picks context."
                : `Just ${moviesRemaining} more to go — add them from your Collections dashboard.`}
            </p>
            {moviesStepComplete ? null : (
              <div className="mt-4 flex flex-wrap gap-2">
                {primaryCollectionPath ? (
                  <Button asChild>
                    <Link href={primaryCollectionPath} prefetch={false}>
                      Add now
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={handleSkipForNow} disabled={completionPending}>
                  {completionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Skip for now"}
                </Button>
              </div>
            )}
          </StepCard>
        ) : null}
      </section>

      {allComplete ? (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-sm text-emerald-200">
          All set! Head back to your dashboard to continue curating.
          <div className="mt-3">
            <Button asChild>
              <Link href="/app">Open dashboard</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface StepCardProps {
  title: string;
  description: string;
  completed: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  status: "active" | "pending" | "done";
}

function StepCard({ title, description, completed, icon, children, status }: StepCardProps) {
  const statusClasses = {
    active: "border-indigo-400/60",
    pending: "border-slate-800/70",
    done: "border-emerald-400/50",
  } as const;

  return (
    <div
      className={`flex h-full flex-col gap-4 rounded-3xl border ${statusClasses[status]} bg-slate-950/70 p-6 shadow-[0_20px_70px_-60px_rgba(15,23,42,0.8)]`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
      {completed ? <p className="text-xs text-emerald-300">Completed</p> : null}
    </div>
  );
}
