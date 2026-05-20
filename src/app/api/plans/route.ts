import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllPlans } from "@/lib/plans";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plans = await getAllPlans();
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Get plans error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
