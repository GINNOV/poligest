import { defaultLocale } from "@/i18n/config";
import { redirect } from "next/navigation";

export default async function HandlerRedirect(props: {
  params: Promise<{ stack?: string[] }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const path = params.stack?.join("/") ?? "";
  const search = new URLSearchParams(searchParams).toString();
  const target = `/${defaultLocale}/handler/${path}${search ? `?${search}` : ""}`;

  redirect(target);
}
