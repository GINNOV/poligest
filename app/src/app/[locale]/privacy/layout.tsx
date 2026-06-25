import type { ReactNode } from "react";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const metadata = createPageMetadata(PAGE_TITLES.privacy);

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}