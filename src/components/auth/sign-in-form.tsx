"use client";

/**
 * Client-side sign-in/sign-up form that talks directly to Supabase auth while
 * handling mode toggles and demo credentials messaging. The component stays
 * self-contained so the page can remain a simple wrapper.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabase } from "@/components/providers/supabase-provider";
import { formatError } from "@/lib/utils";
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { supabase, refreshSession } = useSupabase();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(
    params?.get("mode") === "sign-up" ? "sign-up" : "sign-in"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  /**
   * Handles form submission by performing either a password sign-in or sign-up
   * request. The SupabaseProvider will automatically handle navigation on successful
   * authentication.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        if (!signUpData.session) {
          setLoading(false);
          const verifyEmailUrl = `/auth/verify-email?email=${encodeURIComponent(email)}`;
          router.replace(verifyEmailUrl);
          setMode("sign-in");
          return;
        }
      }

      // The SupabaseProvider will handle navigation automatically when the session is established
    } catch (err) {
      setError(formatError(err));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-800/70 bg-slate-950/70 p-8 shadow-xl backdrop-blur">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-slate-400">
          {mode === "sign-in"
            ? "Sign in to curate and share your collections."
            : "Spin up an account to start cataloging your cinematic universe."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Processing..." : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-400">
        {mode === "sign-in" ? (
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className="text-indigo-300 hover:text-indigo-200"
          >
            Need an account? Sign up instead.
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className="text-indigo-300 hover:text-indigo-200"
          >
            Already joined? Sign in.
          </button>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-xs text-slate-400">
        <p className="font-medium text-slate-200">Demo credentials</p>
        <p>Email: demo@framevault.dev</p>
        <p>Password: FrameVault!2024</p>
      </div>
    </div>
  );
}
