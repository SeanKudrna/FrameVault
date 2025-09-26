/**
 * Miscellaneous UI utilities that appear across the React component tree.
 */

import { clsx, type ClassValue } from "clsx";

/**
 * Joins a variable number of class name values into a single string, skipping
 * falsy inputs. This thin wrapper exists so that consuming components only
 * import from our shared utilities.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}

/**
 * Truncates long text to the desired maximum length, appending an ellipsis when trimming occurs.
 * Used anywhere we display user-generated strings in constrained UI elements.
 */
export function truncate(text: string, max = 140) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Normalises error values into user-friendly messages while falling back to a safe default.
 * Accepts raw strings, `Error` instances, or unknown objects that include a `message` property.
 */
export function formatError(error: unknown, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}
