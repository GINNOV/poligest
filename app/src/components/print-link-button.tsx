"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  href: string;
  label: string;
  title?: string;
  className?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "black" | "destructive" | "destructive-outline";
  size?: "default" | "sm" | "xs" | "lg" | "icon";
};

export function PrintLinkButton({
  href,
  label,
  title,
  className,
  target,
  rel,
  children,
  variant = "outline",
  size = "icon",
}: Props) {
  return (
    <Button asChild variant={variant} size={size} className={className}><Link
        href={href}
        onClick={(event) => event.stopPropagation()}
        aria-label={label}
        title={title ?? label}
        target={target}
        rel={rel}
      >
        {children}
      </Link></Button>
  );
}
