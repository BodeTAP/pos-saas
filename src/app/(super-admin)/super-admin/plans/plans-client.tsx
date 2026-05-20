"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Edit, CheckCircle, XCircle, Tag } from "lucide-react";
import { PlanFormModal } from "@/components/super-admin/plan-form-modal";
import type { PlanInfo } from "@/lib/plans";

interface PlansClientProps {
  initialPlans: PlanInfo[];
}

export function PlansClient({ initialPlans }: PlansClientProps) {
  const [plans, setPlans] = useState(initialPlans);
  const [editPlan, setEditPlan] = useState<PlanInfo | null>(null);

  function handleSaved(saved: PlanInfo) {
    setPlans((prev) => prev.map((p) => (p.tier === saved.tier ? saved : p)));
    setEditPlan(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Paket Langganan</h1>
        <p className="text-gray-500 mt-1">
          Atur harga, fitur, dan batasan paket FREE, PRO, dan ENTERPRISE
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Catatan:</strong> Perubahan harga akan langsung berlaku untuk transaksi
        baru. Tenant yang sudah berlangganan tidak terpengaruh sampai mereka memperpanjang.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.tier}
            className={`bg-white rounded-xl border-2 p-5 transition-colors ${
              plan.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {plan.tier}
                </span>
              </div>
              {plan.isActive ? (
                <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Aktif
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  Nonaktif
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
            {plan.description && (
              <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
            )}

            <div className="mt-4 space-y-1">
              <p className="text-2xl font-bold text-blue-600">
                {plan.monthlyPrice === 0 ? "Gratis" : formatCurrency(plan.monthlyPrice)}
                {plan.monthlyPrice > 0 && (
                  <span className="text-sm font-normal text-gray-500">/bulan</span>
                )}
              </p>
              {plan.yearlyPrice > 0 && (
                <p className="text-xs text-gray-500">
                  Tahunan: {formatCurrency(plan.yearlyPrice)}
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">Produk</p>
                <p className="text-sm font-semibold text-gray-900">
                  {plan.maxProducts >= 9999 ? "∞" : plan.maxProducts}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">Kasir</p>
                <p className="text-sm font-semibold text-gray-900">
                  {plan.maxCashiers >= 99 ? "∞" : plan.maxCashiers}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">Cabang</p>
                <p className="text-sm font-semibold text-gray-900">
                  {plan.maxOutlets >= 99 ? "∞" : plan.maxOutlets}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setEditPlan(plan)}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit Paket
            </button>
          </div>
        ))}
      </div>

      {editPlan && (
        <PlanFormModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
