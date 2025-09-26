"use client";

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

const DEFAULT_DURATION = 3000;

interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastRecord {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  open: boolean;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Math.random().toString(36).slice(2, 11)}`;
}

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

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
