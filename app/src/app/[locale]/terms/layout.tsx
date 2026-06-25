import type { ReactNode } from "react";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const metadata = createPageMetadata(PAGE_TITLES.termini);

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}