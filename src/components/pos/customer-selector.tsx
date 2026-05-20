"use client";

import { useState, useEffect, useRef } from "react";
import { useCartStore } from "@/stores/cart-store";
import { Search, X, UserCircle, Star, Plus, Loader2 } from "lucide-react";

interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  points: number;
}

export function CustomerSelector() {
  const { customer, setCustomer } = useCartStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search debounce
  useEffect(() => {
    if (!open || showAddForm) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        setResults(data.customers || []);
      } finally {
        setIsLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [search, open, showAddForm]);

  function handleSelect(c: CustomerData) {
    setCustomer({
      id: c.id,
      name: c.name,
      phone: c.phone,
      points: c.points,
    });
    setOpen(false);
    setSearch("");
  }

  async function handleAdd() {
    if (!newName.trim()) {
      setError("Nama wajib diisi.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, phone: newPhone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal menambah pelanggan.");
        return;
      }

      handleSelect(data.customer);
      setNewName("");
      setNewPhone("");
      setShowAddForm(false);
    } catch {
      setError("Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {customer ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <UserCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              {customer.points} poin
            </p>
          </div>
          <button
            onClick={() => setCustomer(null)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 border border-gray-200 hover:border-blue-400 rounded-lg text-left transition-colors"
        >
          <UserCircle className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500 flex-1">Pilih pelanggan (opsional)</span>
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-30 overflow-hidden">
          {!showAddForm ? (
            <>
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama atau nomor..."
                    autoFocus
                    className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-xs">Memuat...</span>
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-center py-4 text-xs text-gray-400">
                    {search ? "Tidak ada hasil" : "Mulai ketik untuk mencari"}
                  </p>
                ) : (
                  results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500">{c.phone || "-"}</p>
                        <span className="text-xs text-amber-700 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {c.points}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 border-t border-gray-100 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Pelanggan Baru
              </button>
            </>
          ) : (
            <div className="p-3 space-y-2">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-1.5 rounded text-xs">
                  {error}
                </div>
              )}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama pelanggan"
                autoFocus
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="No. telepon (opsional)"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-3 py-1.5 border border-gray-200 text-gray-700 rounded text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-1.5 rounded text-sm flex items-center justify-center gap-1"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Simpan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
