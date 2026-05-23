import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveOutletId } from "@/lib/active-outlet";
import { parseBody, updateProductSchema } from "@/lib/schemas";
import { logAudit, diffObjects } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.product.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    const parsed = await parseBody(req, updateProductSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const {
      name, sku, barcode, description, buyPrice, sellPrice,
      stock, minStock, unit, categoryId, isActive,
      imageUrl, hasVariants,
    } = parsed.data;

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, tenantId: session.user.tenantId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
      }
    }

    // Validasi SKU unik per tenant jika berubah
    if (sku !== undefined) {
      const trimmedSku = sku?.trim() || null;
      if (trimmedSku && trimmedSku !== existing.sku) {
        const duplicate = await prisma.product.findFirst({
          where: {
            tenantId: session.user.tenantId,
            sku: trimmedSku,
            NOT: { id },
          },
          select: { id: true },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: `SKU "${trimmedSku}" sudah dipakai produk lain.` },
            { status: 409 }
          );
        }
      }
    }

    // Resolve outlet aktif sekali untuk dipakai stock adjustment & response
    const activeOutletId = await getActiveOutletId();

    // Stock adjustment — hanya untuk outlet aktif user
    if (activeOutletId && (stock !== undefined || minStock !== undefined)) {
      const outletStock = await prisma.outletStock.findUnique({
        where: {
          outletId_productId: { outletId: activeOutletId, productId: id },
        },
      });

      if (outletStock && stock !== undefined && stock !== outletStock.stock) {
        await prisma.$transaction([
          prisma.outletStock.update({
            where: { id: outletStock.id },
            data: {
              stock,
              ...(minStock !== undefined && { minStock }),
            },
          }),
          prisma.stockMutation.create({
            data: {
              type: "ADJUSTMENT",
              quantity: stock - outletStock.stock,
              stockBefore: outletStock.stock,
              stockAfter: stock,
              note: "Penyesuaian stok manual",
              tenantId: session.user.tenantId,
              productId: id,
              outletId: activeOutletId,
            },
          }),
        ]);
      } else if (outletStock && minStock !== undefined && minStock !== outletStock.minStock) {
        await prisma.outletStock.update({
          where: { id: outletStock.id },
          data: { minStock },
        });
      } else if (!outletStock) {
        // Belum ada stok di outlet ini — buat record baru
        await prisma.outletStock.create({
          data: {
            outletId: activeOutletId,
            productId: id,
            tenantId: session.user.tenantId,
            stock: stock ?? existing.stock,
            minStock: minStock ?? existing.minStock,
          },
        });
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        sku: sku !== undefined ? sku : existing.sku,
        barcode: barcode !== undefined ? barcode : existing.barcode,
        description: description !== undefined ? description : existing.description,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        buyPrice: buyPrice !== undefined ? buyPrice : existing.buyPrice,
        sellPrice: sellPrice !== undefined ? sellPrice : existing.sellPrice,
        minStock: minStock !== undefined ? minStock : existing.minStock,
        unit: unit ?? existing.unit,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        ...(hasVariants !== undefined && { hasVariants }),
      },
      include: {
        category: true,
        outletStocks: activeOutletId
          ? { where: { outletId: activeOutletId }, take: 1 }
          : false,
      },
    });

    // Override stock dengan nilai dari OutletStock outlet aktif
    const outletStock = updatedProduct.outletStocks?.[0];
    const product = {
      ...updatedProduct,
      stock: outletStock?.stock ?? updatedProduct.stock,
      minStock: outletStock?.minStock ?? updatedProduct.minStock,
      outletStocks: undefined,
    };

    // Audit log
    const diff = diffObjects(
      existing as unknown as Record<string, unknown>,
      updatedProduct as unknown as Record<string, unknown>
    );
    if (diff) {
      logAudit({
        action: "UPDATE",
        entity: "Product",
        entityId: id,
        entityName: updatedProduct.name,
        changes: diff,
        userId: session.user.id,
        tenantId: session.user.tenantId,
      });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user.tenantId || session.user.role === "KASIR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.product.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    logAudit({
      action: "DELETE",
      entity: "Product",
      entityId: id,
      entityName: existing.name,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
