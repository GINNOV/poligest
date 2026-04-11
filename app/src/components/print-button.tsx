"use client";

import { Button } from "./ui/button";

type Props = {
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "black" | "destructive" | "destructive-outline";
  size?: "default" | "sm" | "xs" | "lg";
};

export function PrintButton({ label = "Stampa", className, variant = "primary", size }: Props) {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className={className}
      variant={variant}
      size={size}
    >
      {label}
    </Button>
  );
}
