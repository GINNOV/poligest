import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import ProductManagementPage from "../product-management-page";

export const metadata = createPageMetadata(PAGE_TITLES.impianti);

export const revalidate = 60;

type ImpiantiPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default function ImpiantiPage({ searchParams }: ImpiantiPageProps) {
  return <ProductManagementPage mode="implants" searchParams={searchParams} />;
}
