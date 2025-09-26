"use client";

/**
 * Thin wrappers around Radix toast primitives that align styling with the rest
 * of the FrameVault UI.
 */

import * as ToastPrimitives from "@radix-ui/react-toast";
import type {
  ToastCloseProps,
  ToastDescriptionProps,
  ToastProps as ToastPrimitiveProps,
  ToastTitleProps,
  ToastViewportProps,
} from "@radix-ui/react-toast";
import { forwardRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Supported visual variants for toasts surfaced by the shared toast provider.
 */
type ToastVariant = "default" | "success" | "error" | "info";

/**
 * Maps toast variants to their associated color classes.
 */
const variantClasses: Record<ToastVariant, string> = {
  default: "border-slate-800/70 bg-slate-950/90 text-slate-100",
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  error: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  info: "border-indigo-500/40 bg-indigo-500/15 text-indigo-100",
};

/**
 * Re-exported Radix toast provider used at the application root.
 */
export const ToastProvider = ToastPrimitives.Provider;

/**
 * Props accepted by the `Toast` component, extending Radix's primitives with a variant prop.
 */
export interface ToastProps extends ToastPrimitiveProps {
  variant?: ToastVariant;
}

/**
 * Styled toast container that applies variant-specific colors and animations.
 */
export const Toast = forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(
        "group relative pointer-events-auto flex w-full min-w-[280px] max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_24px_80px_-60px_rgba(15,23,42,1)] transition-all",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:fade-in-80",
        "data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
);
Toast.displayName = ToastPrimitives.Root.displayName;

/**
 * Bold title text rendered within a toast notification.
 */
export const ToastTitle = forwardRef<React.ElementRef<typeof ToastPrimitives.Title>, ToastTitleProps>(
  ({ className, ...props }, ref) => (
    <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
  )
);
ToastTitle.displayName = ToastPrimitives.Title.displayName;

/**
 * Supplemental description copy that appears beneath a toast title.
 */
export const ToastDescription = forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  ToastDescriptionProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-xs text-slate-300", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

/**
 * Close button rendered in the top-right corner of each toast.
 */
export const ToastClose = forwardRef<React.ElementRef<typeof ToastPrimitives.Close>, ToastCloseProps>(
  ({ className, ...props }, ref) => (
    <ToastPrimitives.Close
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-full p-1 text-current/70 transition hover:bg-black/20 hover:text-current",
        className,
      )}
      toast-close=""
      {...props}
    >
      <X size={14} />
    </ToastPrimitives.Close>
  )
);
ToastClose.displayName = ToastPrimitives.Close.displayName;

/**
 * Container that positions toasts near the bottom of the viewport.
 */
export const ToastViewport = forwardRef<React.ElementRef<typeof ToastPrimitives.Viewport>, ToastViewportProps>(
  ({ className, ...props }, ref) => (
    <ToastPrimitives.Viewport
      ref={ref}
      className={cn(
        "pointer-events-none fixed bottom-4 left-1/2 z-[110] flex max-h-screen -translate-x-1/2 flex-col items-center gap-3 px-4", 
        "sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 sm:items-end sm:px-0",
        "max-w-[calc(100vw-2rem)] sm:max-w-sm w-auto",
        className,
      )}
      {...props}
    />
  )
);
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

export type { ToastVariant };
