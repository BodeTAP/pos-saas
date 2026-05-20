"use client";

import { Printer } from "lucide-react";
import { printReceipt } from "@/lib/print-receipt";
import type { ReceiptData } from "./receipt";

interface ReprintButtonProps {
  data: ReceiptData;
}

export function ReprintButton({ data }: ReprintButtonProps) {
  return (
    <button
      onClick={() => printReceipt(data)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors"
      title="Cetak ulang struk"
    >
      <Printer className="w-3.5 h-3.5" />
      Cetak
    </button>
  );
}
