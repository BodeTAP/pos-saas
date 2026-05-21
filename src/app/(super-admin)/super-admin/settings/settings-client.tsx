"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import {
  Settings,
  Plus,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  Save,
  Globe,
  ToggleLeft,
  ToggleRight,
  Mail,
  Send,
  CheckCircle,
} from "lucide-react";
import type { PlatformConfigKey } from "@/lib/platform-config";

interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date | string;
}

interface SettingsClientProps {
  currentUserId: string;
  superAdmins: SuperAdmin[];
  platformConfigs: Record<PlatformConfigKey, string>;
}

export function SettingsClient({ currentUserId, superAdmins, platformConfigs }: SettingsClientProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const [config, setConfig] = useState({
    platform_name: platformConfigs.platform_name,
    support_email: platformConfigs.support_email,
    registration_enabled: platformConfigs.registration_enabled,
    trial_days: platformConfigs.trial_days,
    maintenance_mode: platformConfigs.maintenance_mode,
    maintenance_message: platformConfigs.maintenance_message,
    suspended_message: platformConfigs.suspended_message,
  });

  function handleConfigChange(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function toggleBool(key: string) {
    setConfig((prev) => ({
      ...prev,
      [key]: prev[key as keyof typeof prev] === "true" ? "false" : "true",
    }));
  }

  async function handleSaveConfig() {
    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/super-admin/platform-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan konfigurasi.");
        return;
      }
      toast.success("Konfigurasi platform berhasil disimpan.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    if (id === currentUserId && !isActive) {
      toast.error("Tidak bisa menonaktifkan akun sendiri.");
      return;
    }
    if (
      !confirm(
        isActive
          ? "Aktifkan kembali Super Admin ini?"
          : "Nonaktifkan Super Admin ini? Mereka tidak akan bisa login lagi."
      )
    )
      return;

    const res = await fetch(`/api/super-admin/admins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      toast.success(isActive ? "Super Admin diaktifkan." : "Super Admin dinonaktifkan.");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Gagal mengubah status.");
    }
  }

  const isMaintenanceOn = config.maintenance_mode === "true";
  const isRegistrationOn = config.registration_enabled === "true";

  // Email notification state
  const [isSendingLowStock, setIsSendingLowStock] = useState(false);
  const [isSendingTrialReminder, setIsSendingTrialReminder] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<string | null>(null);

  async function handleSendLowStock() {
    setIsSendingLowStock(true);
    setEmailTestResult(null);
    try {
      const res = await fetch("/api/notifications/low-stock", {
        method: "POST",
        headers: { "x-cron-secret": "manual-trigger" },
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailTestResult(`Error: ${data.error}`);
        return;
      }
      setEmailTestResult(`✓ Low stock: ${data.sent} email terkirim dari ${data.total} grup.`);
    } catch {
      setEmailTestResult("Gagal mengirim. Cek RESEND_API_KEY di .env");
    } finally {
      setIsSendingLowStock(false);
    }
  }

  async function handleSendTrialReminder() {
    setIsSendingTrialReminder(true);
    setEmailTestResult(null);
    try {
      const res = await fetch("/api/notifications/trial-reminder", {
        method: "POST",
        headers: { "x-cron-secret": "manual-trigger" },
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailTestResult(`Error: ${data.error}`);
        return;
      }
      setEmailTestResult(`✓ Trial reminder: ${data.sent} email terkirim.`);
    } catch {
      setEmailTestResult("Gagal mengirim. Cek RESEND_API_KEY di .env");
    } finally {
      setIsSendingTrialReminder(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Konfigurasi Sistem</h1>
        <p className="text-gray-500 mt-1">Pengaturan global platform & manajemen Super Admin</p>
      </div>

      {/* Platform Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Konfigurasi Platform</h2>
            <p className="text-sm text-gray-500">Pengaturan global yang berlaku untuk seluruh platform</p>
          </div>
        </div>

        {/* Branding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Platform</label>
            <input
              value={config.platform_name}
              onChange={(e) => handleConfigChange("platform_name", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="POS SaaS"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Support</label>
            <input
              type="email"
              value={config.support_email}
              onChange={(e) => handleConfigChange("support_email", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="support@pos-saas.com"
            />
          </div>
        </div>

        {/* Trial & Registration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durasi Trial (hari)
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={config.trial_days}
              onChange={(e) => handleConfigChange("trial_days", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">0 = tidak ada trial, langsung aktif</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registrasi Tenant Baru
            </label>
            <button
              type="button"
              onClick={() => toggleBool("registration_enabled")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isRegistrationOn
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
            >
              {isRegistrationOn ? (
                <><ToggleRight className="w-5 h-5" /> Registrasi Aktif</>
              ) : (
                <><ToggleLeft className="w-5 h-5" /> Registrasi Dinonaktifkan</>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-1">
              {isRegistrationOn
                ? "Tenant baru bisa mendaftar mandiri"
                : "Halaman register akan menampilkan pesan tidak tersedia"}
            </p>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-orange-900">Mode Maintenance</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Saat aktif, semua tenant (kecuali Super Admin) tidak bisa login
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleBool("maintenance_mode")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isMaintenanceOn
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "bg-white text-orange-700 border border-orange-300 hover:bg-orange-50"
              }`}
            >
              {isMaintenanceOn ? (
                <><ToggleRight className="w-5 h-5" /> Aktif</>
              ) : (
                <><ToggleLeft className="w-5 h-5" /> Nonaktif</>
              )}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-orange-800 mb-1">
              Pesan Maintenance
            </label>
            <textarea
              value={config.maintenance_message}
              onChange={(e) => handleConfigChange("maintenance_message", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm bg-white"
            />
          </div>
        </div>

        {/* Suspended Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pesan untuk Tenant Suspended
          </label>
          <textarea
            value={config.suspended_message}
            onChange={(e) => handleConfigChange("suspended_message", e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={isSavingConfig}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
        >
          {isSavingConfig ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
          ) : (
            <><Save className="w-4 h-4" /> Simpan Konfigurasi</>
          )}
        </button>
      </div>

      {/* Email Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Notifikasi Email</h2>
            <p className="text-sm text-gray-500">Kirim email notifikasi ke tenant secara manual atau via cron job</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
          Email dikirim via <strong>Resend</strong>. Pastikan <code className="bg-blue-100 px-1 rounded">RESEND_API_KEY</code> sudah diisi di <code className="bg-blue-100 px-1 rounded">.env</code>.
          Email otomatis terkirim saat: registrasi baru, pembayaran berhasil.
        </div>

        {emailTestResult && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${emailTestResult.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {emailTestResult.startsWith("✓") ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {emailTestResult}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="font-medium text-gray-900 text-sm mb-1">⚠️ Low Stock Alert</p>
            <p className="text-xs text-gray-500 mb-3">Kirim email ke semua Owner yang punya produk stok di bawah minimum.</p>
            <button
              onClick={handleSendLowStock}
              disabled={isSendingLowStock}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-3 py-2 rounded-lg text-sm font-medium w-full justify-center"
            >
              {isSendingLowStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim Sekarang
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <p className="font-medium text-gray-900 text-sm mb-1">⏰ Trial Reminder</p>
            <p className="text-xs text-gray-500 mb-3">Kirim reminder ke tenant yang trial berakhir dalam 1 atau 3 hari.</p>
            <button
              onClick={handleSendTrialReminder}
              disabled={isSendingTrialReminder}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-2 rounded-lg text-sm font-medium w-full justify-center"
            >
              {isSendingTrialReminder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim Sekarang
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
          <strong>Untuk produksi:</strong> Jadwalkan endpoint berikut via cron job harian dengan header <code>x-cron-secret: {"{CRON_SECRET}"}</code>
          <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
            <li><code>POST /api/notifications/low-stock</code></li>
            <li><code>POST /api/notifications/trial-reminder</code></li>
          </ul>
        </div>
      </div>

      {/* Super Admin Management */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Manajemen Super Admin</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {superAdmins.length} akun Super Admin terdaftar
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bergabung</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {superAdmins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    {admin.name}
                    {admin.id === currentUserId && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                        Anda
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{admin.email}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      admin.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {admin.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(admin.createdAt)}</td>
                <td className="px-4 py-3 text-center">
                  {admin.id !== currentUserId && (
                    <button
                      onClick={() => handleToggleActive(admin.id, !admin.isActive)}
                      className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                    >
                      {admin.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddSuperAdminModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

function AddSuperAdminModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/super-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat akun.");
        return;
      }
      toast.success("Super Admin berhasil ditambahkan.");
      router.refresh();
      onClose();
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Tambah Super Admin</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Hati-hati:</strong> Super Admin punya akses penuh ke seluruh platform.
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={isLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Menambah...</> : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
