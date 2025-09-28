"use client";

/**
 * Cutting-edge authenticated layout with glass morphism sidebar, animated navigation,
 * and modern user profile card. Features immersive design with smooth interactions.
 */

import { BarChart3, Compass, CreditCard, Film, History, LayoutDashboard, LogOut, Settings, Menu, X, User, Crown, Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
 * Modern navigation items with enhanced icons and plan-based visibility.
 */
const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, description: "Your collections" },
  { href: "/discover", label: "Discover", icon: Compass, description: "Find new films" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, description: "Insights & stats", plan: "pro" as const },
  { href: "/app/history", label: "History", icon: History, description: "Watch history" },
  { href: "/settings/profile", label: "Profile", icon: Settings, description: "Account settings" },
  { href: "/settings/billing", label: "Billing", icon: CreditCard, description: "Manage plan" },
];

/**
 * Modern app shell with glass morphism sidebar, mobile navigation, and smooth animations.
 */
export function AppShell({ children, profile }: AppShellProps) {
  const pathname = usePathname();
  const { signOut } = useSupabase();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getPlanGradient = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'pro': return 'from-accent-tertiary to-accent-secondary';
      case 'plus': return 'from-accent-secondary to-accent-primary';
      default: return 'from-text-muted to-text-tertiary';
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'pro': return <Crown className="w-4 h-4" />;
      case 'plus': return <Star className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary custom-scrollbar">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 bottom-[78px] z-50 w-80 transform transition-all duration-300 ease-out md:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col glass-card m-4 rounded-3xl border border-border-primary p-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/app" className="flex items-center gap-3 group">
              <div className="p-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary">
                <Film className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-gradient text-lg">FrameVault</p>
                <p className="text-xs text-text-tertiary">Movie Collections</p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="space-y-2 mb-8">
            {navItems
              .filter((item) => !item.plan || item.plan === profile.plan)
              .map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "group flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:scale-105",
                      isActive
                        ? "glass-card border-accent-primary/50 bg-surface-hover"
                        : "hover:bg-surface-hover"
                    )}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-all duration-200",
                      isActive
                        ? `bg-gradient-to-r ${getPlanGradient(profile.plan)}`
                        : "bg-surface-secondary group-hover:bg-surface-primary"
                    )}>
                      <Icon className={cn(
                        "w-5 h-5 transition-colors",
                        isActive ? "text-white" : "text-text-tertiary group-hover:text-text-primary"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium transition-colors",
                        isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
                      )}>
                        {item.label}
                      </p>
                      <p className="text-xs text-text-tertiary truncate">{item.description}</p>
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
                    )}
                  </Link>
                );
              })}
          </nav>

          {/* User Profile Card */}
          <div className="mt-auto">
            <div className="glass p-4 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-r",
                  getPlanGradient(profile.plan)
                )}>
                  {getPlanIcon(profile.plan)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {profile.display_name ?? profile.username}
                  </p>
                  <p className="text-sm text-text-tertiary">@{profile.username}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-tertiary uppercase tracking-wide">Plan</span>
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r",
                  getPlanGradient(profile.plan),
                  "text-white"
                )}>
                  {profile.plan.toUpperCase()}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={signOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300 ease-out min-h-screen",
        "md:ml-80"
      )}>
        {/* Mobile Header */}
        <header className="md:hidden glass-card m-4 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <Link href="/app" className="font-bold text-gradient">
              FrameVault
            </Link>

            <div className={cn(
              "px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r",
              getPlanGradient(profile.plan),
              "text-white"
            )}>
              {profile.plan}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-8 pb-20">
          {children}
        </div>
      </main>
    </div>
  );
}
