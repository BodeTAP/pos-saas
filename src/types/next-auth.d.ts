import { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      tenantId: string | null;
      outletId: string | null;
      subscriptionStatus: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: UserRole;
    tenantId: string | null;
    outletId?: string | null;
    subscriptionStatus?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    tenantId: string | null;
    outletId: string | null;
    subscriptionStatus: string | null;
    issuedAt?: number;
  }
}
