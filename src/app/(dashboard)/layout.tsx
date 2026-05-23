import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  // Cek apakah email sudah diverifikasi (hanya untuk OWNER, bukan KASIR/SUPER_ADMIN)
  let emailVerified = true;
  let userEmail = session.user.email || "";

  if (session.user.role === "OWNER" && session.user.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true, email: true },
    });
    emailVerified = !!user?.emailVerified;
    userEmail = user?.email || userEmail;
  }

  return (
    <DashboardShell
      user={session.user}
      emailVerified={emailVerified}
      userEmail={userEmail}
    >
      {children}
    </DashboardShell>
  );
}
