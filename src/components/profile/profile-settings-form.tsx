"use client";

/**
 * Interactive profile settings form that syncs with the Supabase context after
 * a successful update.
 */

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { Profile } from "@/lib/supabase/types";
import { updateProfileAction } from "@/app/(app)/settings/actions";

/**
 * Client form for updating a user's public display name and username.
 */
export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const { setProfile } = useSupabase();
  const { toast } = useToast();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  /**
   * Submits the profile update via server action and surfaces toast feedback.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        await updateProfileAction({ username, displayName });
        setProfile({ ...profile, username, display_name: displayName || null });
        setError(null);
        setMessage("Profile updated");
        toast({
          title: "Profile saved",
          description: "Your public profile is up to date.",
          variant: "success",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update profile";
        setError(message);
        toast({ title: "Unable to update profile", description: message, variant: "error" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-slate-500" htmlFor="display-name">
          Display name
        </label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.24em] text-slate-500" htmlFor="username">
          Username
        </label>
        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
          pattern="[a-zA-Z0-9-]+"
          title="Only letters, numbers, and hyphens"
          required
        />
        <p className="text-xs text-slate-500">Public pages will live at framevault.app/c/{username}</p>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
