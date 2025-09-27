"use client";

/**
 * Share button for public collection pages. Attempts to use the Web Share API
 * when available, falling back to copying the URL to the clipboard.
 */

import { useCallback, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

interface PublicShareActionsProps {
  shareUrl: string;
  accentColor?: string;
  accentForeground?: string;
}

export function PublicShareActions({ shareUrl, accentColor, accentForeground }: PublicShareActionsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url: shareUrl });
        return;
      }
    } catch {
      // Ignore share errors and fall back to clipboard copy.
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Share it anywhere to showcase this collection.",
        variant: "success",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to copy link";
      toast({ title: "Share failed", description: message, variant: "error" });
    }
  }, [shareUrl, toast]);

  const customStyle = accentColor && accentForeground
    ? { backgroundColor: accentColor, color: accentForeground, borderColor: accentColor }
    : undefined;

  return (
    <Button
      variant={accentColor ? "ghost" : "muted"}
      size="lg"
      onClick={handleShare}
      className={cn(
        "min-w-[200px] justify-center",
        accentColor ? "shadow-[0_18px_80px_-50px_rgba(15,23,42,1)] hover:opacity-95" : undefined
      )}
      style={customStyle}
    >
      {copied ? <Check size={18} /> : <Share2 size={18} />}
      {copied ? "Link copied" : "Share collection"}
    </Button>
  );
}
