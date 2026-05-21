import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth-config";
import { applyScheduledDowngradeIfDue } from "@/lib/billing-actions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      // Jalankan base JWT callback dari authConfig dulu
      const token = await (authConfig.callbacks?.jwt as NonNullable<typeof authConfig.callbacks>["jwt"])!(params);

      // Cek & terapkan downgrade terjadwal saat token di-refresh (setiap 5 menit)
      // Hanya untuk tenant user (bukan Super Admin), dan hanya saat refresh (bukan login pertama)
      const isRefresh = !params.user && token?.tenantId && token?.role !== "SUPER_ADMIN";
      if (isRefresh) {
        const wasDowngraded = await applyScheduledDowngradeIfDue(token.tenantId as string);
        if (wasDowngraded) {
          // Update token agar middleware tahu status berubah
          token.subscriptionStatus = "EXPIRED";
        }
      }

      return token;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { tenant: true },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        // Cek status tenant saat login
        if (user.role !== "SUPER_ADMIN" && user.tenant) {
          const { subscriptionStatus, subscriptionEndsAt } = user.tenant;
          if (subscriptionStatus === "SUSPENDED") {
            throw new Error("ACCOUNT_SUSPENDED");
          }
          if (
            subscriptionStatus === "EXPIRED" &&
            subscriptionEndsAt &&
            subscriptionEndsAt < new Date()
          ) {
            throw new Error("SUBSCRIPTION_EXPIRED");
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          outletId: user.outletId,
          subscriptionStatus: user.tenant?.subscriptionStatus ?? null,
        };
      },
    }),
  ],
});