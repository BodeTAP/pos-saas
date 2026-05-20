import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPaymentChannels } from "@/lib/tripay";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user.tenantId || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const channels = await getPaymentChannels();
    // Filter hanya yang aktif
    const active = channels.filter((c) => c.active);

    return NextResponse.json({ channels: active });
  } catch (error) {
    console.error("Get channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
