"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "black" | "destructive" | "destructive-outline";
  size?: "default" | "sm" | "xs" | "lg" | "icon";
  loading?: boolean;
  loadingLabel?: string;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", loading, loadingLabel, children, disabled, asChild = false, ...props }, ref) => {
    const variantClass = {
      primary: "btn-primary",
      secondary: "btn-secondary",
      outline: "btn-outline",
      ghost: "btn-ghost",
      black: "btn-black",
      destructive: "btn-destructive",
      "destructive-outline": "btn-destructive-outline",
    }[variant];

    const sizeClass = {
      default: "btn-md",
      sm: "btn-sm",
      xs: "btn-xs",
      lg: "btn-lg",
      icon: "btn-icon",
    }[size];

    const mergedClassName = cn(variantClass, sizeClass, className);

    if (asChild) {
      return (
        <Slot
          className={mergedClassName}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={mergedClassName}
        ref={ref}
        disabled={disabled || loading}
        type={props.type || "button"}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          />
        )}
        <span>{loading && loadingLabel ? loadingLabel : children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
