import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("button inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      primary: "button-primary bg-[var(--blue)] text-white shadow-sm hover:bg-[var(--blue-dark)]",
      secondary: "button-secondary border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]",
      ghost: "button-ghost text-[var(--muted)] hover:bg-[var(--surface-2)]",
      danger: "button-danger bg-[var(--red)] text-white hover:opacity-90",
    },
    size: {
      sm: "button-sm h-8 px-3 text-xs",
      md: "button-md h-10 px-4 text-sm",
      lg: "button-lg h-12 px-5 text-base",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
