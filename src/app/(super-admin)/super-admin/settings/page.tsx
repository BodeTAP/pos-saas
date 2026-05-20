import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SettingsClient } from "./settings-client";

export default async function SystemSettingsPage() {
  const session = await auth();
  if (!session) return null;

  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <SettingsClient
      currentUserId={session.user.id}
      superAdmins={superAdmins}
    />
  );
}
