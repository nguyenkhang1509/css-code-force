import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} data-slot="input" className={cn("input h-10 px-3 py-2 text-sm file:border-0 file:bg-transparent placeholder:text-[var(--muted)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />,
);
Input.displayName = "Input";
