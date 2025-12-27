import { execSync } from "node:child_process";

if (!process.env.NEXT_PUBLIC_DEPLOYED_AT) {
  process.env.NEXT_PUBLIC_DEPLOYED_AT = new Date().toISOString();
}

execSync("next build", { stdio: "inherit", env: process.env });
