"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlanGateProps {
  title: string;
  message: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function PlanGate({ title, message, ctaLabel = "View plans", onCtaClick }: PlanGateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-8 text-center text-slate-200">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
        <Lock size={24} />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="max-w-md text-sm text-indigo-100/80">{message}</p>
      </div>
      <Button variant="muted" onClick={onCtaClick}>
        {ctaLabel}
      </Button>
    </div>
  );
}
