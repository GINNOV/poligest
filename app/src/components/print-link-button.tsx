"use client";

import Link from "next/link";

type Props = {
  href: string;
  label: string;
  title?: string;
  className?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
  children: React.ReactNode;
};

export function PrintLinkButton({
  href,
  label,
  title,
  className,
  target,
  rel,
  children,
}: Props) {
  return (
    <Link
      href={href}
      onClick={(event) => event.stopPropagation()}
      className={className}
      aria-label={label}
      title={title ?? label}
      target={target}
      rel={rel}
    >
      {children}
    </Link>
  );
}
