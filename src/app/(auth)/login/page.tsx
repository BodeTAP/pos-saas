import { getPlatformConfig, PLATFORM_CONFIG_KEYS } from "@/lib/platform-config";
import { LoginClient } from "./login-client";

interface SearchParams {
  callbackUrl?: string;
  error?: string;
  reason?: string;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [maintenanceMode, maintenanceMessage, platformName] = await Promise.all([
    getPlatformConfig(PLATFORM_CONFIG_KEYS.MAINTENANCE_MODE),
    getPlatformConfig(PLATFORM_CONFIG_KEYS.MAINTENANCE_MESSAGE),
    getPlatformConfig(PLATFORM_CONFIG_KEYS.PLATFORM_NAME),
  ]);

  return (
    <LoginClient
      maintenanceMode={maintenanceMode === "true"}
      maintenanceMessage={maintenanceMessage}
      platformName={platformName}
      callbackUrl={params.callbackUrl || "/dashboard"}
      errorParam={params.error}
      reason={params.reason}
    />
  );
}
