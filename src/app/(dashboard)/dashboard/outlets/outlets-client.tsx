"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, Store, MapPin, Users, ShoppingBag, ArrowLeftRight } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { OutletFormModal, type OutletData } from "@/components/outlets/outlet-form-modal";
import { TransferStockModal } from "@/components/outlets/transfer-stock-modal";

export interface OutletWithCount extends OutletData {
  _count: { users: number; transactions: number };
}

interface OutletsClientProps {
  initialOutlets: OutletWithCount[];
  maxOutlets: number;
  plan: string;
}

export function OutletsClient({ initialOutlets, maxOutlets, plan }: OutletsClientProps) {
  const router = useRouter();
  const [outlets, setOutlets] = useState<OutletWithCount[]>(initialOutlets);
  const [showModal, setShowModal] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editOutlet, setEditOutlet] = useState<OutletData | null>(null);

  const activeCount = outlets.filter((o) => o.isActive).length;
  const canAddMore = outlets.length < maxOutlets;

  function handleSaved(saved: OutletData) {
    setOutlets((prev) => {
      const exists = prev.find((o) => o.id === saved.id);
      if (exists) {
        return prev.map((o) =>
          o.id === saved.id ? { ...o, ...saved } : o
        );
      }
      return [
        ...prev,
        { ...saved, _count: { users: 0, transactions: 0 } } as OutletWithCount,
      ];
    });
    setShowModal(false);
    setEditOutlet(null);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Nonaktifkan cabang ini? Cabang tidak bisa dipakai untuk transaksi baru."))
      return;
    const res = await fetch(`/api/outlets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOutlets((prev) =>
        prev.map((o) => (o.id === id ? { ...o, isActive: false } : o))
      );
      toast.success("Cabang berhasil dinonaktifkan.");
    } else {
      const data = await res.json();
      toast.error(data.error || "Gagal menonaktifkan cabang.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Cabang</h1>
          <p className="text-gray-500 mt-1">
            {activeCount}/{maxOutlets} cabang aktif (Paket {plan})
          </p>
        </div>
      <div className="flex items-center gap-2">
        {outlets.filter((o) => o.isActive).length > 1 && (
          <button
            onClick={() => setShowTransfer(true)}
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Transfer Stok
          </button>
        )}
        <button
          onClick={() => {
            setEditOutlet(null);
            setShowModal(true);
          }}
          disabled={!canAddMore}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
          title={!canAddMore ? `Batas cabang paket ${plan} tercapai` : ""}
        >
          <Plus className="w-4 h-4" />
          Tambah Cabang
        </button>
      </div>
      </div>

      {!canAddMore && plan !== "ENTERPRISE" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Multi-cabang hanya tersedia di paket Enterprise.</strong> Upgrade paket
          untuk menambahkan cabang lebih banyak.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {outlets.map((outlet) => (
          <div
            key={outlet.id}
            className={`bg-white rounded-xl border p-5 transition-colors ${
              outlet.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-2">
                {outlet.isMain && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    Utama
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    outlet.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {outlet.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            </div>

            <h3 className="font-semibold text-gray-900">{outlet.name}</h3>
            {outlet.address && (
              <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{outlet.address}</span>
              </p>
            )}
            {outlet.phone && (
              <p className="text-xs text-gray-500 mt-0.5">📞 {outlet.phone}</p>
            )}

            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {outlet._count.users} user
              </span>
              <span className="flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                {outlet._count.transactions} transaksi
              </span>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setEditOutlet(outlet);
                  setShowModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
              {!outlet.isMain && outlet.isActive && (
                <button
                  onClick={() => handleDeactivate(outlet.id)}
                  className="flex items-center justify-center px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors"
                  title="Nonaktifkan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {outlets.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Store className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Belum ada cabang</p>
        </div>
      )}

      {showModal && (
        <OutletFormModal
          outlet={editOutlet}
          onClose={() => {
            setShowModal(false);
            setEditOutlet(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {showTransfer && (
        <TransferStockModal
          outlets={outlets.filter((o) => o.isActive).map((o) => ({ id: o.id, name: o.name }))}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => {
            setShowTransfer(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
