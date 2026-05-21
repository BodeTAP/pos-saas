import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseBody, createCustomerSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = {
      tenantId: session.user.tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({ customers, total, page, limit });
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

    const parsed = await parseBody(req, createCustomerSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const { name, phone, email } = parsed.data;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Nama pelanggan wajib diisi." },
        { status: 400 }
      );
    }

    // Cek duplikasi phone menggunakan unique constraint (lebih efisien dari findFirst)
    if (phone) {
      const existing = await prisma.customer.findUnique({
        where: {
          phone_tenantId: { phone, tenantId: session.user.tenantId },
        },
        select: { id: true },
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
