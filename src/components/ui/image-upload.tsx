"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  shape?: "square" | "circle";
}

const sizeMap = {
  sm: { container: "w-20 h-20", icon: "w-6 h-6" },
  md: { container: "w-32 h-32", icon: "w-8 h-8" },
  lg: { container: "w-48 h-48", icon: "w-10 h-10" },
};

export function ImageUpload({
  value,
  onChange,
  folder = "products",
  label = "Upload Gambar",
  size = "md",
  shape = "square",
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { container, icon } = sizeMap[size];
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Gagal mengupload gambar.");
        return;
      }

      onChange(data.url);
      toast.success("Gambar berhasil diupload.");
    } catch {
      toast.error("Terjadi kesalahan saat mengupload.");
    } finally {
      setIsUploading(false);
      // Reset input agar bisa upload file yang sama lagi
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative ${container} ${shapeClass} border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group`}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className={`${icon} text-blue-500 animate-spin`} />
        ) : value ? (
          <>
            <Image
              src={value}
              alt="Preview"
              fill
              className="object-cover"
              unoptimized
            />
            {/* Overlay saat hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <ImageIcon className={icon} />
            <span className="text-xs text-center px-2">{label}</span>
          </div>
        )}
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
        >
          <X className="w-3 h-3" />
          Hapus gambar
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-xs text-gray-400 text-center">
        JPG, PNG, WebP · Maks 2MB
      </p>
    </div>
  );
}
