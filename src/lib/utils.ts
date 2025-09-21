import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}

export function truncate(text: string, max = 140) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function formatError(error: unknown, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}
