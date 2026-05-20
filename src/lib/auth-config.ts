import type { NextAuthConfig } from "next-auth";
import { UserRole } from "@prisma/client";

/**
 * Minimal auth config aman untuk edge runtime (middleware).
 * Tidak boleh import Prisma atau bcryptjs di sini.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.tenantId = (user as { tenantId: string | null }).tenantId;
        token.outletId = (user as { outletId?: string | null }).outletId ?? null;
        token.subscriptionStatus =
          (user as { subscriptionStatus?: string }).subscriptionStatus ?? null;
        token.issuedAt = Date.now();
      }

      // Manual update via session.update() — saat switch outlet atau refresh status
      if (trigger === "update" && updateData) {
        const update = updateData as {
          outletId?: string | null;
          subscriptionStatus?: string | null;
        };
        if (update.outletId !== undefined) token.outletId = update.outletId;
        if (update.subscriptionStatus !== undefined) {
          token.subscriptionStatus = update.subscriptionStatus;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.tenantId = token.tenantId as string | null;
        session.user.outletId = token.outletId as string | null;
        session.user.subscriptionStatus = token.subscriptionStatus as string | null;
      }
      return session;
    },
  },
  providers: [], // ditambahkan di auth.ts (yang full server-side)
};
