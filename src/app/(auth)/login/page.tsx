import { getPlatformConfig, PLATFORM_CONFIG_KEYS } from "@/lib/platform-config";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
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
    />
  );
}
