import { prisma } from "@/lib/prisma";

/**
 * Kunci konfigurasi platform yang dikelola Super Admin.
 * Semua nilai disimpan sebagai string di tabel platform_configs.
 */
export const PLATFORM_CONFIG_KEYS = {
  // Branding
  PLATFORM_NAME: "platform_name",
  SUPPORT_EMAIL: "support_email",

  // Registrasi
  REGISTRATION_ENABLED: "registration_enabled", // "true" | "false"
  TRIAL_DAYS: "trial_days", // angka dalam hari

  // Maintenance
  MAINTENANCE_MODE: "maintenance_mode", // "true" | "false"
  MAINTENANCE_MESSAGE: "maintenance_message",

  // Suspended tenant message
  SUSPENDED_MESSAGE: "suspended_message",
} as const;

export type PlatformConfigKey = (typeof PLATFORM_CONFIG_KEYS)[keyof typeof PLATFORM_CONFIG_KEYS];

/**
 * Default values — dipakai kalau record belum ada di DB
 */
export const PLATFORM_CONFIG_DEFAULTS: Record<PlatformConfigKey, string> = {
  platform_name: "POS SaaS",
  support_email: "support@pos-saas.com",
  registration_enabled: "true",
  trial_days: "14",
  maintenance_mode: "false",
  maintenance_message: "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.",
  suspended_message:
    "Akun Anda telah disuspend oleh administrator. Hubungi support untuk informasi lebih lanjut.",
};

/**
 * Ambil satu nilai konfigurasi. Fallback ke default kalau tidak ada.
 */
export async function getPlatformConfig(key: PlatformConfigKey): Promise<string> {
  const record = await prisma.platformConfig.findUnique({ where: { key } });
  return record?.value ?? PLATFORM_CONFIG_DEFAULTS[key];
}

/**
 * Ambil semua konfigurasi sekaligus (untuk halaman settings Super Admin)
 */
export async function getAllPlatformConfigs(): Promise<Record<PlatformConfigKey, string>> {
  const records = await prisma.platformConfig.findMany();
  const map = Object.fromEntries(records.map((r) => [r.key, r.value])) as Partial<
    Record<PlatformConfigKey, string>
  >;

  // Merge dengan defaults
  const result = { ...PLATFORM_CONFIG_DEFAULTS };
  for (const key of Object.values(PLATFORM_CONFIG_KEYS)) {
    if (map[key] !== undefined) result[key] = map[key]!;
  }
  return result;
}

/**
 * Set satu nilai konfigurasi (upsert)
 */
export async function setPlatformConfig(key: PlatformConfigKey, value: string): Promise<void> {
  await prisma.platformConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Set banyak konfigurasi sekaligus
 */
export async function setPlatformConfigs(
  configs: Partial<Record<PlatformConfigKey, string>>
): Promise<void> {
  await Promise.all(
    Object.entries(configs).map(([key, value]) =>
      prisma.platformConfig.upsert({
        where: { key },
        update: { value: value! },
        create: { key, value: value! },
      })
    )
  );
}
