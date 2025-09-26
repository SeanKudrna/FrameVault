"use client";

/**
 * Lightweight toast system built on Radix primitives. Manages a queue of
 * notifications and exposes a simple hook.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider as RadixToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastVariant,
} from "@/components/ui/toast";

/**
 * Default time (ms) before a toast automatically dismisses.
 */
const DEFAULT_DURATION = 3000;

/**
 * Options accepted when showing a toast notification.
 */
interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

/**
 * Internal toast representation tracked in state.
 */
interface ToastRecord {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  open: boolean;
}

/**
 * Context value exposed to components via the `useToast` hook.
 */
interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Generates a stable unique identifier for toasts. Uses `crypto.randomUUID` when available.
 */
function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Provides toast state management and renders the Radix toast primitives.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const setOpenState = useCallback((id: string, open: boolean) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id
          ? {
              ...toast,
              open,
            }
          : toast
      )
    );
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = options.id ?? generateId();
    setToasts((current) => {
      const next: ToastRecord = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? "default",
        duration: options.duration ?? DEFAULT_DURATION,
        open: true,
      };

      // Replace any existing toast with the same id and trim the queue to keep
      // the viewport manageable on small screens.
      const filtered = current.filter((item) => item.id !== id);
      return [...filtered, next].slice(-4);
    });
    return id;
  }, []);

  const contextValue = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={contextValue}>
      <RadixToastProvider swipeDirection="right">
        {children}
        {toasts.map((toastItem) => (
          <Toast
            key={toastItem.id}
            variant={toastItem.variant}
            open={toastItem.open}
            duration={toastItem.duration}
            onOpenChange={(open) => {
              if (!open) {
                setOpenState(toastItem.id, open);
                setTimeout(() => dismiss(toastItem.id), 200);
              } else {
                setOpenState(toastItem.id, open);
              }
            }}
          >
            {toastItem.title ? <ToastTitle>{toastItem.title}</ToastTitle> : null}
            {toastItem.description ? <ToastDescription>{toastItem.description}</ToastDescription> : null}
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </RadixToastProvider>
    </ToastContext.Provider>
  );
}

/**
 * Hook for accessing the toast context, ensuring the provider is mounted.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
