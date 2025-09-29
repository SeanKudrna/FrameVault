import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  className,
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={selectRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full rounded-xl border border-border-secondary bg-surface-primary px-4 py-3 text-left text-sm text-text-primary",
          "flex items-center justify-between",
          "focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20",
          "transition-all duration-200",
          "hover:border-accent-secondary/60",
          !disabled && "cursor-pointer",
          disabled && "cursor-not-allowed opacity-50",
          isOpen && "border-accent-primary ring-2 ring-accent-primary/20"
        )}
      >
        <span className={cn(selectedOption ? "text-text-primary" : "text-text-tertiary")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-tertiary transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border-primary bg-surface-primary/95 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden">
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onValueChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-4 py-3 text-left text-sm transition-colors hover:bg-surface-secondary/80 cursor-pointer border-0",
                index === 0 && "rounded-t-xl",
                index === options.length - 1 && "rounded-b-xl",
                option.value === value
                  ? "bg-accent-primary/15 text-black font-bold"
                  : "text-text-primary"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
