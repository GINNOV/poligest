import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      locale: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    locale: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    locale?: string;
  }
}
