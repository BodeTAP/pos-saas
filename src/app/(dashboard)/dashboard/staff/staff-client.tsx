"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { Plus, Edit, Trash2, Users, Shield, Store } from "lucide-react";
import { StaffFormModal, type StaffMember } from "@/components/staff/staff-form-modal";

interface OutletSummary {
  id: string;
  name: string;
  isMain: boolean;
}

interface StaffClientProps {
  initialStaff: StaffMember[];
  maxCashiers: number;
  plan: string;
  outlets: OutletSummary[];
}

const roleLabel: Record<string, string> = {
  OWNER: "Pemilik",
  KASIR: "Kasir",
};

export function StaffClient({ initialStaff, maxCashiers, plan, outlets }: StaffClientProps) {
  const [staff, setStaff] = useState(initialStaff);
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);

  const cashierCount = staff.filter((s) => s.role === "KASIR" && s.isActive).length;
  const canAddMore = cashierCount < maxCashiers;

  function handleSaved(saved: StaffMember) {
    setStaff((prev) => {
      const exists = prev.find((s) => s.id === saved.id);
      if (exists) return prev.map((s) => (s.id === saved.id ? saved : s));
      return [...prev, saved];
    });
    setShowModal(false);
    setEditStaff(null);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Nonaktifkan kasir ini? Mereka tidak akan bisa login lagi.")) return;
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStaff((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: false } : s))
      );
      toast.success("Kasir berhasil dinonaktifkan.");
    } else {
      const data = await res.json();
      toast.error(data.error || "Gagal menonaktifkan kasir.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Karyawan</h1>
          <p className="text-gray-500 mt-1">
            {staff.length} pengguna · {cashierCount}/{maxCashiers} kasir aktif (Paket {plan})
          </p>
        </div>
        <button
          onClick={() => {
            setEditStaff(null);
            setShowModal(true);
          }}
          disabled={!canAddMore}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
          title={!canAddMore ? `Batas kasir paket ${plan} tercapai` : ""}
        >
          <Plus className="w-4 h-4" />
          Tambah Kasir
        </button>
      </div>

      {!canAddMore && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-700">
          <strong>Batas kasir tercapai.</strong> Paket {plan} hanya mengizinkan {maxCashiers} kasir aktif.
          Nonaktifkan kasir lama atau upgrade paket untuk menambah kasir baru.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Peran</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cabang</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bergabung</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.length === 0 ? (
              <tr>
              <td colSpan={7} className="text-center py-12 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada karyawan</p>
                </td>
              </tr>
            ) : (
              staff.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {user.role === "OWNER" && (
                        <Shield className="w-3.5 h-3.5 text-purple-500" />
                      )}
                      {user.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === "OWNER"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {roleLabel[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.outlet?.name ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Store className="w-3 h-3 text-gray-400" />
                        {user.outlet.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {user.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    {user.role === "OWNER" ? (
                      <span className="text-xs text-gray-400 flex justify-center">
                        —
                      </span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditStaff(user);
                            setShowModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {user.isActive && (
                          <button
                            onClick={() => handleDeactivate(user.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Nonaktifkan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <StaffFormModal
          staff={editStaff}
          outlets={outlets}
          onClose={() => {
            setShowModal(false);
            setEditStaff(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
