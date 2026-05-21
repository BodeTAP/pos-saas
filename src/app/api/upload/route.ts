import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    // FIX 8: Whitelist upload folder to prevent path traversal
    const rawFolder = formData.get("folder") as string;
    const ALLOWED_FOLDERS = ["products", "logos", "avatars"] as const;
    const folder = ALLOWED_FOLDERS.includes(rawFolder as typeof ALLOWED_FOLDERS[number])
      ? rawFolder
      : "products";

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Ukuran file maksimal ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${session.user.tenantId}/${folder}/${Date.now()}.${ext}`;

    // Coba public dulu, fallback ke error yang jelas kalau store adalah private
    let blob;
    try {
      blob = await put(filename, file, {
        access: "public",
        contentType: file.type,
      });
    } catch (publicError) {
      if (
        publicError instanceof Error &&
        publicError.message.includes("private store")
      ) {
        return NextResponse.json(
          {
            error:
              "Blob Store dikonfigurasi sebagai Private. Buat Blob Store baru dengan akses Public di Vercel Dashboard.",
          },
          { status: 503 }
        );
      }
      throw publicError;
    }

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Upload error:", error);

    if (error instanceof Error) {
      if (error.message.includes("BLOB_READ_WRITE_TOKEN")) {
        return NextResponse.json(
          { error: "Upload gambar belum dikonfigurasi. Set BLOB_READ_WRITE_TOKEN di .env" },
          { status: 503 }
        );
      }
      if (error.message.includes("private store")) {
        return NextResponse.json(
          {
            error:
              "Blob Store dikonfigurasi sebagai Private. Buat Blob Store baru dengan akses Public di Vercel Dashboard untuk upload gambar.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Gagal mengupload gambar." }, { status: 500 });
  }
}
