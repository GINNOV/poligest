import ProductManagementPage from "../product-management-page";

export const revalidate = 60;

type ProdottiPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default function ProdottiPage({ searchParams }: ProdottiPageProps) {
  return <ProductManagementPage mode="products" searchParams={searchParams} />;
}
