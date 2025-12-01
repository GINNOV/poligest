import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { compare } from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";

if (!process.env.NEXTAUTH_SECRET) {
  // Fail fast to avoid booting without required secret
  throw new Error("NEXTAUTH_SECRET non impostata");
}

type Credentials = {
  email?: string;
  password?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenziali",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(
        credentials: Record<"email" | "password", string> | undefined,
      ) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = normalizeEmail(credentials.email);
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const passwordValid = await compare(
          credentials.password,
          user.hashedPassword,
        );

        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          locale: user.locale ?? "it",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: Role }).role;
        token.locale = (user as { locale?: string }).locale ?? "it";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub ?? "";
        session.user.role = (token as { role?: Role }).role ?? Role.SECRETARY;
        session.user.locale = (token as { locale?: string }).locale ?? "it";
      }
      return session;
    },
  },
};

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireUser(allowedRoles?: Role[]) {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect("/auth/login");
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    redirect("/");
  }

  return session;
}

export const hasRole = (role: Role, allowed: Role[]) => allowed.includes(role);
