"use client";

import { useState } from "react";
import { Plus, Edit, Trash2, Tag, Loader2, X } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface CategoryData {
  id: string;
  name: string;
  _count: { products: number };
}

interface CategoriesClientProps {
  initialCategories: CategoryData[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryData | null>(null);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setEditCategory(null);
    setName("");
    setError("");
    setShowModal(true);
  }

  function openEdit(cat: CategoryData) {
    setEditCategory(cat);
    setName(cat.name);
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const url = editCategory ? `/api/categories/${editCategory.id}` : "/api/categories";
      const method = editCategory ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan kategori.");
        return;
      }
      if (editCategory) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editCategory.id ? data.category : c))
        );
        toast.success("Kategori berhasil diperbarui.");
      } else {
        setCategories((prev) => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Kategori berhasil ditambahkan.");
      }
      setShowModal(false);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(cat: CategoryData) {
    if (cat._count.products > 0) {
      toast.error(`Kategori "${cat.name}" masih dipakai ${cat._count.products} produk.`);
      return;
    }
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;

    // Optimistic delete
    const original = categories.find((c) => c.id === cat.id);
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));

    const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Kategori berhasil dihapus.");
    } else {
      // Rollback
      if (original) {
        setCategories((prev) =>
          [...prev, original].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      const data = await res.json();
      toast.error(data.error || "Gagal menghapus kategori.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kategori Produk</h1>
          <p className="text-gray-500 mt-1">{categories.length} kategori terdaftar</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Kategori
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama Kategori</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Jumlah Produk</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-gray-400">
                  <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Belum ada kategori</p>
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-500" />
                      {cat.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {cat._count.products} produk
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={cat._count.products > 0}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title={cat._count.products > 0 ? "Masih ada produk di kategori ini" : "Hapus"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editCategory ? "Edit Kategori" : "Tambah Kategori"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Contoh: Minuman, Makanan, Snack"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  ) : editCategory ? "Simpan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
