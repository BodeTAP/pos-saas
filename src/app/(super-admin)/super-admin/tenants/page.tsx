import { prisma } from "@/lib/prisma";
import { TenantsClient } from "./tenants-client";

interface SearchParams {
  search?: string;
  status?: string;
  plan?: string;
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search?.trim() || "";
  const status = params.status || "ALL";
  const plan = params.plan || "ALL";

  const tenants = await prisma.tenant.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(status !== "ALL" && {
        subscriptionStatus: status as
          | "ACTIVE"
          | "EXPIRED"
          | "SUSPENDED"
          | "TRIAL",
      }),
      ...(plan !== "ALL" && {
        plan: plan as "FREE" | "PRO" | "ENTERPRISE",
      }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, products: true, transactions: true } },
    },
  });

  return (
    <TenantsClient
      initialTenants={tenants}
      initialFilters={{ search, status, plan }}
    />
  );
}
