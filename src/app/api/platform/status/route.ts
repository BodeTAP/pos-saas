import { NextResponse } from "next/server";
import {
  getPlatformConfig,
  PLATFORM_CONFIG_KEYS,
} from "@/lib/platform-config";

/**
 * Public endpoint — cek status platform (maintenance mode, nama platform)
 * Dipanggil dari halaman login/register sebelum render
 */
export async function GET() {
  try {
    const [maintenanceMode, maintenanceMessage, platformName, registrationEnabled] =
      await Promise.all([
        getPlatformConfig(PLATFORM_CONFIG_KEYS.MAINTENANCE_MODE),
        getPlatformConfig(PLATFORM_CONFIG_KEYS.MAINTENANCE_MESSAGE),
        getPlatformConfig(PLATFORM_CONFIG_KEYS.PLATFORM_NAME),
        getPlatformConfig(PLATFORM_CONFIG_KEYS.REGISTRATION_ENABLED),
      ]);

    return NextResponse.json({
      maintenanceMode: maintenanceMode === "true",
      maintenanceMessage,
      platformName,
      registrationEnabled: registrationEnabled === "true",
    });
  } catch (error) {
    console.error("Platform status error:", error);
    // Fallback — jangan block user kalau DB error
    return NextResponse.json({
      maintenanceMode: false,
      maintenanceMessage: "",
      platformName: "POS SaaS",
      registrationEnabled: true,
    });
  }
}
