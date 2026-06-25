import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import ProductManagementPage from "../product-management-page";

export const metadata = createPageMetadata(PAGE_TITLES.prodotti);

export const revalidate = 60;

type ProdottiPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default function ProdottiPage({ searchParams }: ProdottiPageProps) {
  return <ProductManagementPage mode="products" searchParams={searchParams} />;
}
