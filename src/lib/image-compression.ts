/**
 * Kompresi gambar di client-side menggunakan Canvas API.
 * Tidak perlu library tambahan, semua pakai browser API native.
 *
 * Strategi:
 * 1. Resize gambar ke max dimension yang masuk akal (1200px)
 * 2. Konversi ke WebP (40-60% lebih kecil dari JPEG dengan kualitas sama)
 * 3. Fallback ke JPEG quality 0.85 jika browser tidak support WebP
 *
 * Hasil: gambar 4MB bisa jadi ~150-300KB, tetap berkualitas baik.
 */

export interface CompressOptions {
  /** Max width atau height dalam pixel. Default 1200. */
  maxDimension?: number;
  /** Kualitas JPEG/WebP 0-1. Default 0.85. */
  quality?: number;
  /** Format output. Default auto (WebP jika support, JPEG jika tidak). */
  format?: "auto" | "webp" | "jpeg" | "png";
  /**
   * Skip kompresi jika file sudah di bawah threshold ini (bytes).
   * Default 100KB — file kecil sudah optimal, tidak perlu di-recompress.
   */
  skipIfSmallerThan?: number;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxDimension: 1200,
  quality: 0.85,
  format: "auto",
  skipIfSmallerThan: 100 * 1024, // 100KB
};

/**
 * Cek apakah browser support encoding ke WebP via canvas.
 */
function supportsWebP(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const dataUrl = canvas.toDataURL("image/webp");
  return dataUrl.startsWith("data:image/webp");
}

/**
 * Load File ke HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal memuat gambar."));
    };
    img.src = url;
  });
}

/**
 * Hitung dimensi target setelah resize, mempertahankan aspect ratio.
 */
function getResizedDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round((height / width) * maxDimension),
    };
  }
  return {
    width: Math.round((width / height) * maxDimension),
    height: maxDimension,
  };
}

/**
 * Kompres gambar menggunakan canvas.
 * Return File baru yang sudah dikompres.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip jika bukan gambar
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Skip kompresi untuk GIF (bisa kehilangan animasi) dan SVG
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  // Skip jika file sudah cukup kecil dan tidak butuh resize
  if (file.size < opts.skipIfSmallerThan) {
    // Cek dimensi — kalau dimensi besar tetap perlu resize meski file kecil
    try {
      const img = await loadImage(file);
      if (img.width <= opts.maxDimension && img.height <= opts.maxDimension) {
        return file;
      }
    } catch {
      return file;
    }
  }

  try {
    const img = await loadImage(file);
    const { width, height } = getResizedDimensions(
      img.width,
      img.height,
      opts.maxDimension
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Quality scaling untuk hasil yang lebih halus saat downsize
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    // Tentukan format output
    let outputType: string;
    if (opts.format === "webp" || (opts.format === "auto" && supportsWebP())) {
      outputType = "image/webp";
    } else if (opts.format === "png") {
      outputType = "image/png";
    } else {
      outputType = "image/jpeg";
    }

    // Convert canvas ke Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, opts.quality);
    });

    if (!blob) {
      console.warn("Kompresi gagal, gunakan file asli.");
      return file;
    }

    // Jika hasil kompresi malah lebih besar dari original, pakai original
    if (blob.size >= file.size) {
      return file;
    }

    // Generate nama file baru dengan ekstensi yang sesuai
    const ext = outputType === "image/webp" ? "webp"
      : outputType === "image/png" ? "png"
      : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const newName = `${baseName}.${ext}`;

    return new File([blob], newName, { type: outputType, lastModified: Date.now() });
  } catch (err) {
    console.warn("Image compression failed:", err);
    return file;
  }
}

/**
 * Format ukuran file ke string yang readable.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
