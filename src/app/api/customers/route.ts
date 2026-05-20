import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Get customers error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, email } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Nama pelanggan wajib diisi." },
        { status: 400 }
      );
    }

    // Cek duplikasi phone (jika diisi)
    if (phone) {
      const existing = await prisma.customer.findFirst({
        where: { tenantId: session.user.tenantId, phone },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Pelanggan dengan nomor ${phone} sudah terdaftar.` },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        tenantId: session.user.tenantId,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("Create customer error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
