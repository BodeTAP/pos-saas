import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAllPlatformConfigs } from "@/lib/platform-config";
import { SettingsClient } from "./settings-client";

export default async function SystemSettingsPage() {
  const session = await auth();
  if (!session) return null;

  const [superAdmins, platformConfigs] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    getAllPlatformConfigs(),
  ]);

  return (
    <SettingsClient
      currentUserId={session.user.id}
      superAdmins={superAdmins}
      platformConfigs={platformConfigs}
    />
  );
}
