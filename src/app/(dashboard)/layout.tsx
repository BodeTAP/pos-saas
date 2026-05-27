import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { BusinessType } from "@prisma/client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  let emailVerified = true;
  let userEmail = session.user.email || "";
  let businessType: BusinessType = "RETAIL";

  if (session.user.tenantId) {
    const [user, tenant] = await Promise.all([
      session.user.role === "OWNER" && session.user.id
        ? prisma.user.findUnique({
            where: { id: session.user.id },
            select: { emailVerified: true, email: true },
          })
        : null,
      prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { businessType: true },
      }),
    ]);

    if (user) {
      emailVerified = !!user.emailVerified;
      userEmail = user.email || userEmail;
    }
    if (tenant?.businessType) {
      businessType = tenant.businessType;
    }
  }

  return (
    <DashboardShell
      user={session.user}
      emailVerified={emailVerified}
      userEmail={userEmail}
      businessType={businessType}
    >
      {children}
    </DashboardShell>
  );
}
