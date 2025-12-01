import { redirect } from "next/navigation";
import { stackServerApp } from "@/lib/stack-app";

export default function LoginPage() {
  redirect(stackServerApp.urls.signIn);
}
