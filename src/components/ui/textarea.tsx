"use client";

/**
 * Modern textarea component with floating labels and enhanced styling.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props for the enhanced Textarea component.
 */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Modern textarea component with floating label, validation states, and smooth animations.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(Boolean(props.defaultValue || props.value));

    const generatedId = React.useId();
    const textareaId = id || `textarea-${generatedId}`;

    React.useEffect(() => {
      setHasValue(Boolean(props.value));
    }, [props.value]);

    return (
      <div className="relative">
        <div className="relative">
          <textarea
            id={textareaId}
            className={cn(
              "flex min-h-[120px] w-full rounded-xl border bg-surface-primary px-4 py-3 text-sm text-text-primary placeholder:text-transparent transition-all duration-200 resize-y",
              "focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary",
              "hover:border-border-secondary",
              error
                ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/50"
                : "border-border-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            ref={ref}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            onChange={(e) => {
              setHasValue(Boolean(e.target.value));
              props.onChange?.(e);
            }}
            {...props}
          />

          {/* Floating Label */}
          {label && (
            <label
              htmlFor={textareaId}
              className={cn(
                "absolute left-4 transition-all duration-200 pointer-events-none",
                (isFocused || hasValue)
                  ? "top-1 text-xs font-medium text-accent-primary"
                  : "top-3 text-sm text-text-tertiary"
              )}
            >
              {label}
            </label>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
            <span className="w-1 h-1 bg-red-400 rounded-full"></span>
            {error}
          </p>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <p className="mt-2 text-sm text-text-tertiary flex items-center gap-1">
            <span className="w-1 h-1 bg-text-tertiary rounded-full"></span>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
