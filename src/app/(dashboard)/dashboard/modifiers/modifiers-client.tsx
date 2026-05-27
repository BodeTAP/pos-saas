"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toaster";
import { Plus, Edit, Trash2, X, Loader2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ModifierOption {
  id?: string;
  name: string;
  extraPrice: number;
  isDefault: boolean;
  position: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  minSelect: number;
  maxSelect: number;
  productCount: number;
  options: ModifierOption[];
}

interface ProductItem {
  id: string;
  name: string;
  assignedGroupIds: string[];
}

interface ModifiersClientProps {
  initialGroups: ModifierGroup[];
  products: ProductItem[];
}

export function ModifiersClient({ initialGroups, products }: ModifiersClientProps) {
  const [groups, setGroups] = useState<ModifierGroup[]>(initialGroups);
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<ModifierGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  function handleSaved(saved: ModifierGroup) {
    setGroups((prev) => {
      const exists = prev.find((g) => g.id === saved.id);
      if (exists) return prev.map((g) => (g.id === saved.id ? saved : g));
      return [...prev, saved];
    });
    setShowModal(false);
    setEditGroup(null);
  }

  async function handleDelete(group: ModifierGroup) {
    if (!confirm(`Hapus modifier "${group.name}"? Semua produk yang menggunakan modifier ini akan terpengaruh.`)) return;
    setIsDeleting(group.id);
    try {
      const res = await fetch(`/api/modifiers/${group.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Gagal menghapus modifier.");
        return;
      }
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      toast.success(`Modifier "${group.name}" berhasil dihapus.`);
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsDeleting(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Modifier Menu</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Kelola add-on dan pilihan tambahan untuk menu F&B (kepedasan, suhu, ukuran, dll)
          </p>
        </div>
        <button
          onClick={() => { setEditGroup(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Modifier
        </button>
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-gray-500 font-medium">Belum ada modifier</p>
          <p className="text-sm text-gray-400 mt-1">
            Tambahkan modifier seperti tingkat kepedasan, suhu minuman, atau ukuran porsi
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Tambah Modifier Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    {expandedId === group.id
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />
                    }
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      {group.required && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Wajib</span>
                      )}
                      {group.multiple && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Multi-pilih</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {group.options.length} opsi · {group.productCount} produk
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setShowAssignModal(group)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Assign ke produk"
                  >
                    <Package className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setEditGroup(group); setShowModal(true); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group)}
                    disabled={isDeleting === group.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30"
                  >
                    {isDeleting === group.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Options (expanded) */}
              {expandedId === group.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${
                          opt.isDefault
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : "bg-gray-50 border-gray-200 text-gray-700"
                        }`}
                      >
                        <span>{opt.name}</span>
                        {opt.extraPrice > 0 && (
                          <span className="text-xs text-gray-500">+{formatCurrency(opt.extraPrice)}</span>
                        )}
                        {opt.isDefault && (
                          <span className="text-xs text-blue-500">(default)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <ModifierFormModal
          key={editGroup?.id ?? "new"}
          group={editGroup}
          onClose={() => { setShowModal(false); setEditGroup(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <AssignProductsModal
          group={showAssignModal}
          products={products}
          onClose={() => setShowAssignModal(null)}
          onSaved={(groupId, assignedProductIds) => {
            // Update local product state
            setGroups((prev) =>
              prev.map((g) =>
                g.id === groupId
                  ? { ...g, productCount: assignedProductIds.length }
                  : g
              )
            );
            setShowAssignModal(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Form Modal
// ─────────────────────────────────────────────

function ModifierFormModal({
  group,
  onClose,
  onSaved,
}: {
  group: ModifierGroup | null;
  onClose: () => void;
  onSaved: (g: ModifierGroup) => void;
}) {
  const [name, setName] = useState(group?.name || "");
  const [required, setRequired] = useState(group?.required ?? false);
  const [multiple, setMultiple] = useState(group?.multiple ?? false);
  const [options, setOptions] = useState<ModifierOption[]>(
    group?.options.length
      ? group.options
      : [{ name: "", extraPrice: 0, isDefault: false, position: 0 }]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function addOption() {
    setOptions((prev) => [
      ...prev,
      { name: "", extraPrice: 0, isDefault: false, position: prev.length },
    ]);
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateOption(idx: number, field: keyof ModifierOption, value: string | number | boolean) {
    setOptions((prev) =>
      prev.map((opt, i) => (i === idx ? { ...opt, [field]: value } : opt))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validOptions = options.filter((o) => o.name.trim());
    if (!name.trim()) { setError("Nama grup wajib diisi."); return; }
    if (validOptions.length === 0) { setError("Minimal satu opsi wajib diisi."); return; }

    setIsLoading(true);
    try {
      const url = group ? `/api/modifiers/${group.id}` : "/api/modifiers";
      const method = group ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          required,
          multiple,
          minSelect: required ? 1 : 0,
          maxSelect: multiple ? validOptions.length : 1,
          options: validOptions.map((o, idx) => ({
            name: o.name.trim(),
            extraPrice: o.extraPrice || 0,
            isDefault: o.isDefault,
            position: idx,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal menyimpan."); return; }

      toast.success(group ? "Modifier berhasil diperbarui." : "Modifier berhasil ditambahkan.");
      onSaved({
        id: data.group.id,
        name: data.group.name,
        required: data.group.required,
        multiple: data.group.multiple,
        minSelect: data.group.minSelect,
        maxSelect: data.group.maxSelect,
        productCount: group?.productCount ?? 0,
        options: data.group.options,
      });
    } catch {
      setError("Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {group ? "Edit Modifier" : "Tambah Modifier"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Grup <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tingkat Kepedasan, Suhu, Ukuran..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Wajib dipilih</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={multiple}
                onChange={(e) => setMultiple(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Bisa pilih lebih dari satu</span>
            </label>
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Opsi <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addOption}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Tambah Opsi
              </button>
            </div>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={opt.name}
                    onChange={(e) => updateOption(idx, "name", e.target.value)}
                    placeholder={`Opsi ${idx + 1} (misal: Pedas)`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={opt.extraPrice}
                    onChange={(e) => updateOption(idx, "extraPrice", parseFloat(e.target.value) || 0)}
                    placeholder="Harga tambah"
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"
                    title="Harga tambahan (0 = gratis)"
                  />
                  <label className="flex items-center gap-1 cursor-pointer flex-shrink-0" title="Set sebagai default">
                    <input
                      type="checkbox"
                      checked={opt.isDefault}
                      onChange={(e) => updateOption(idx, "isDefault", e.target.checked)}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs text-gray-500">Default</span>
                  </label>
                  {options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Harga tambahan: 0 = gratis</p>
          </div>
        </form>

        <div className="p-5 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Assign Products Modal
// ─────────────────────────────────────────────

function AssignProductsModal({
  group,
  products,
  onClose,
  onSaved,
}: {
  group: ModifierGroup;
  products: ProductItem[];
  onClose: () => void;
  onSaved: (groupId: string, assignedProductIds: string[]) => void;
}) {
  // Produk yang sudah di-assign ke group ini
  const initialAssigned = products
    .filter((p) => p.assignedGroupIds.includes(group.id))
    .map((p) => p.id);

  const [selected, setSelected] = useState<Set<string>>(new Set(initialAssigned));
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setIsLoading(true);
    try {
      const toAdd = [...selected].filter((id) => !initialAssigned.includes(id));
      const toRemove = initialAssigned.filter((id) => !selected.has(id));

      const promises: Promise<Response>[] = [];
      if (toAdd.length > 0) {
        promises.push(
          fetch(`/api/modifiers/${group.id}/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds: toAdd }),
          })
        );
      }
      if (toRemove.length > 0) {
        promises.push(
          fetch(`/api/modifiers/${group.id}/products`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds: toRemove }),
          })
        );
      }

      await Promise.all(promises);
      toast.success("Produk berhasil diperbarui.");
      onSaved(group.id, [...selected]);
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assign ke Produk</h2>
            <p className="text-sm text-gray-500">{group.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtered.map((product) => (
            <label
              key={product.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(product.id)}
                onChange={() => toggle(product.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-800">{product.name}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">Tidak ada produk ditemukan.</p>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : `Simpan (${selected.size} produk)`}
          </button>
        </div>
      </div>
    </div>
  );
}
