import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_FOLDERS = ["products", "logos", "avatars"] as const;
const FILE_EXTENSIONS: Record<(typeof ALLOWED_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type UploadFolder = (typeof ALLOWED_FOLDERS)[number];

function isUploadFolder(value: FormDataEntryValue | null): value is UploadFolder {
  return typeof value === "string" && ALLOWED_FOLDERS.includes(value as UploadFolder);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const rawFolder = formData.get("folder");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }

    if (!isUploadFolder(rawFolder)) {
      return NextResponse.json({ error: "Folder upload tidak valid." }, { status: 400 });
    }

    if (
      session.user.role === "KASIR" &&
      (rawFolder === "products" || rawFolder === "logos")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const ext = FILE_EXTENSIONS[file.type];
    const filename =
      `${session.user.tenantId}/${rawFolder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

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
