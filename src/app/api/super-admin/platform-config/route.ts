import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAllPlatformConfigs,
  setPlatformConfigs,
  PLATFORM_CONFIG_KEYS,
  type PlatformConfigKey,
} from "@/lib/platform-config";

export async function GET() {
  try {
    const session = await auth();
    if (session?.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const configs = await getAllPlatformConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Get platform config error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validKeys = Object.values(PLATFORM_CONFIG_KEYS);
    const updates: Partial<Record<PlatformConfigKey, string>> = {};

    for (const [key, value] of Object.entries(body)) {
      if (validKeys.includes(key as PlatformConfigKey)) {
        updates[key as PlatformConfigKey] = String(value);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Tidak ada konfigurasi valid yang dikirim." }, { status: 400 });
    }

    await setPlatformConfigs(updates);
    const configs = await getAllPlatformConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Update platform config error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
