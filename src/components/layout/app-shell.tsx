"use client";

/**
 * Authenticated layout frame including sidebar navigation, user summary, and
 * sign-out controls. Client-side to access Supabase context helpers.
 */

import { Film, LayoutDashboard, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/components/providers/supabase-provider";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Props for the authenticated application shell layout.
 */
interface AppShellProps {
  children: React.ReactNode;
  profile: Profile;
}

/**
 * Navigation options displayed in the sidebar for authenticated users.
 */
const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings/profile", label: "Profile", icon: Settings },
];

/**
 * Renders the authenticated layout with navigation, user info, and sign-out controls.
 */
export function AppShell({ children, profile }: AppShellProps) {
  const pathname = usePathname();
  const { signOut } = useSupabase();

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-6 py-10 md:px-8 lg:px-12">
        <aside className="hidden w-64 flex-shrink-0 flex-col gap-6 rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 shadow-[0_20px_80px_-60px_rgba(15,23,42,0.7)] md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
              <Film size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-200">FrameVault</p>
              <p className="text-xs text-slate-400">{profile.plan.toUpperCase()} plan</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1 text-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                    isActive
                      ? "bg-indigo-500/20 text-indigo-100"
                      : "text-slate-400 hover:bg-slate-900/70 hover:text-slate-100"
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Signed in</p>
            <div>
              <p className="text-sm font-medium text-slate-100">{profile.display_name ?? profile.username}</p>
              <p className="text-xs text-slate-500">@{profile.username}</p>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-center" onClick={signOut}>
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="flex-1 space-y-8 pb-16">
          <div className="md:hidden">
            <div className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">FrameVault</p>
                <p className="text-xs text-slate-500">{profile.plan.toUpperCase()} plan</p>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut size={16} />
                Sign out
              </Button>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
