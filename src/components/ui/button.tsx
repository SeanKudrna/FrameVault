"use client";

/**
 * Shared button primitive used across the application. Encapsulates styling
 * variants so feature modules can stay lean.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Modern variants backing the shared `Button` component with glass morphism and gradient effects.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden cursor-pointer",
  {
    variants: {
      variant: {
        default: [
          "bg-gradient-to-r from-accent-primary to-accent-secondary text-white",
          "shadow-[0_4px_20px_rgba(139,92,246,0.3)]",
          "hover:shadow-[0_8px_32px_rgba(139,92,246,0.4)]",
          "hover:scale-105 active:scale-95",
          "hover:!text-[#0a0a0f]",
          "before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        ],
        secondary: [
          "bg-gradient-to-r from-accent-secondary to-accent-tertiary text-white",
          "shadow-[0_4px_20px_rgba(6,182,212,0.3)]",
          "hover:shadow-[0_8px_32px_rgba(6,182,212,0.4)]",
          "hover:scale-105 active:scale-95",
          "hover:!text-[#0a0a0f]",
          "before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        ],
        glass: [
          "glass text-text-primary",
          "hover:glass-hover",
          "shadow-[0_4px_20px_rgba(0,0,0,0.2)]",
          "hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
        ],
        ghost: [
          "bg-transparent text-text-secondary",
          "hover:bg-surface-hover hover:text-text-primary",
          "hover:scale-105 active:scale-95",
        ],
        outline: [
          "border border-border-primary bg-transparent text-text-primary",
          "hover:bg-surface-hover hover:border-accent-primary",
          "hover:scale-105 active:scale-95",
        ],
        destructive: [
          "bg-gradient-to-r from-red-500 to-red-600 text-white",
          "shadow-[0_4px_20px_rgba(239,68,68,0.3)]",
          "hover:shadow-[0_8px_32px_rgba(239,68,68,0.4)]",
          "hover:scale-105 active:scale-95",
          "hover:!text-[#0a0a0f]",
          "before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        ],
        success: [
          "bg-gradient-to-r from-green-500 to-green-600 text-white",
          "shadow-[0_4px_20px_rgba(34,197,94,0.3)]",
          "hover:shadow-[0_8px_32px_rgba(34,197,94,0.4)]",
          "hover:scale-105 active:scale-95",
          "hover:!text-[#0a0a0f]",
          "before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        ],
        warning: [
          "bg-gradient-to-r from-yellow-500 to-orange-500 text-white",
          "shadow-[0_4px_20px_rgba(245,158,11,0.3)]",
          "hover:shadow-[0_8px_32px_rgba(245,158,11,0.4)]",
          "hover:scale-105 active:scale-95",
          "hover:!text-[#0a0a0f]",
          "before:absolute before:inset-0 before:bg-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        ],
      },
      size: {
        default: "h-12 px-6 text-sm font-semibold",
        sm: "h-10 px-4 text-xs font-semibold",
        lg: "h-14 px-8 text-base font-semibold",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Props accepted by the shared `Button` component, including support for variant and size styling.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

/**
 * Loading spinner component for buttons.
 */
const LoadingSpinner = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  return (
    <svg
      className={cn("animate-spin", sizeClasses[size])}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

/**
 * FrameVault's primary button component. Supports Radix `Slot` rendering and visual variants.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // Extract icon from children if present
    const childrenArray = React.Children.toArray(children);
    const hasIcon = childrenArray.length > 1;
    const icon = hasIcon ? childrenArray[0] : null;
    const text = hasIcon ? childrenArray.slice(1) : childrenArray;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          loading && "cursor-not-allowed opacity-70",
          className
        )}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner size={size === "lg" ? "md" : size === "sm" ? "sm" : "sm"} />
            <span>Loading...</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {icon}
            {text}
          </span>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
