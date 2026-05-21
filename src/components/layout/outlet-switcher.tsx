"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "@/components/ui/toaster";
import { Store, ChevronDown, Check, Loader2 } from "lucide-react";

interface OutletData {
  id: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
}

export function OutletSwitcher() {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [outlets, setOutlets] = useState<OutletData[]>([]);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);

  useEffect(() => {
    async function loadOutlets() {
      try {
        const res = await fetch("/api/outlets");
        const data = await res.json();
        setOutlets((data.outlets || []).filter((o: OutletData) => o.isActive));
      } catch (e) {
        console.error("Failed to load outlets:", e);
      }
    }
    if (session?.user.role === "OWNER") loadOutlets();
  }, [session?.user.role]);

  // Hanya tampilkan switcher kalau ada > 1 cabang & user adalah Owner
  if (session?.user.role !== "OWNER" || outlets.length <= 1) return null;

  const currentOutlet = outlets.find((o) => o.id === session.user.outletId);

  async function handleSwitch(outletId: string) {
    setIsSwitching(outletId);
    try {
      const res = await fetch("/api/outlets/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal berpindah cabang.");
        return;
      }

      // Update session token lalu hard reload halaman
      // router.refresh() tidak cukup karena server component punya cache
      await update({ outletId });
      window.location.reload();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsSwitching(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-sm transition-colors"
      >
        <Store className="w-4 h-4 text-blue-600" />
        <span className="text-gray-700 font-medium">
          {currentOutlet?.name || "Pilih Cabang"}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              Pindah Cabang
            </div>
            {outlets.map((outlet) => {
              const isActive = outlet.id === session.user.outletId;
              return (
                <button
                  key={outlet.id}
                  onClick={() => !isActive && handleSwitch(outlet.id)}
                  disabled={isActive || isSwitching !== null}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Store className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 truncate">{outlet.name}</span>
                  {outlet.isMain && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                      Utama
                    </span>
                  )}
                  {isSwitching === outlet.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isActive ? (
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
