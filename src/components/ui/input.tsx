"use client";

/**
 * Modern input components with floating labels and enhanced styling.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Props for the enhanced Input component.
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Modern input component with floating label, validation states, and smooth animations.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, id, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(Boolean(props.defaultValue || props.value));

    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    React.useEffect(() => {
      setHasValue(Boolean(props.value));
    }, [props.value]);

    return (
      <div className="relative">
        <div className="relative">
          <input
            id={inputId}
            type={type}
            className={cn(
              "flex h-12 w-full rounded-xl border bg-surface-primary px-4 py-3 text-sm text-text-primary placeholder:text-transparent transition-all duration-200",
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
              htmlFor={inputId}
              className={cn(
                "absolute left-4 transition-all duration-200 pointer-events-none",
                (isFocused || hasValue)
                  ? "top-1 text-xs font-medium text-accent-primary"
                  : "top-1/2 -translate-y-1/2 text-sm text-text-tertiary"
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
Input.displayName = "Input";
