import { getPlatformConfig, PLATFORM_CONFIG_KEYS } from "@/lib/platform-config";
import { RegisterClient } from "./register-client";

export default async function RegisterPage() {
  const [registrationEnabled, platformName] = await Promise.all([
    getPlatformConfig(PLATFORM_CONFIG_KEYS.REGISTRATION_ENABLED),
    getPlatformConfig(PLATFORM_CONFIG_KEYS.PLATFORM_NAME),
  ]);

  return (
    <RegisterClient
      registrationEnabled={registrationEnabled === "true"}
      platformName={platformName}
    />
  );
}
