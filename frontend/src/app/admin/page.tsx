"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Card, PageLoader, StatCard } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPeso } from "@/lib/format";

interface PlatformAnalytics {
  establishments: {
    total: number;
    byStatus: Record<string, number>;
    active: number;
    suspended: number;
  };
  users: { total: number };
  customers: { total: number };
  stamps: { last30d: number };
  mrr: { cents: number; currency: string; activeSubscriptions: number };
  subscriptions: { trial: number; canceled: number };
}

const STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "brand"> = {
  ACTIVE: "green",
  PENDING: "amber",
  SUSPENDED: "red",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activos",
  PENDING: "Pendientes",
  SUSPENDED: "Suspendidos",
};

export default function AdminOverviewPage() {
  const { status } = useAuth();

  const query = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api.get<PlatformAnalytics>("/admin/analytics"),
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;
  const d = query.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Resumen de plataforma</h1>
        <p className="mt-1 text-sm text-ink-600">Estado general del SaaS de fidelidad.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Locales" value={d?.establishments.total ?? 0} sub={`${d?.establishments.active ?? 0} activos`} accent />
        <StatCard label="Usuarios" value={d?.users.total ?? 0} sub="Cuentas activas" />
        <StatCard label="Clientes con sellos" value={d?.customers.total ?? 0} />
        <StatCard label="Sellos en 30 días" value={d?.stamps.last30d ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Monetización</h2>
          <p className="mt-2 text-3xl font-bold text-ink-950">
            {d ? formatPeso(d.mrr.cents, d.mrr.currency) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-600">MRR · {d?.mrr.activeSubscriptions ?? 0} suscripciones activas</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="green">{d?.subscriptions.trial ?? 0} en prueba</Badge>
            <Badge tone="red">{d?.subscriptions.canceled ?? 0} canceladas</Badge>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink-900">Locales por estado</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(d?.establishments.byStatus ?? {}).length === 0 && (
              <p className="text-sm text-ink-600">Sin locales todavía.</p>
            )}
            {Object.entries(d?.establishments.byStatus ?? {}).map(([st, count]) => (
              <div key={st} className="flex items-center gap-3">
                <span className="w-28 text-sm text-ink-700">{STATUS_LABEL[st] ?? st}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${d?.establishments.total ? (count / d.establishments.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-semibold text-ink-900">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={STATUS_TONE.ACTIVE}>{d?.establishments.active ?? 0} activos</Badge>
            <Badge tone={STATUS_TONE.SUSPENDED}>{d?.establishments.suspended ?? 0} suspendidos</Badge>
            <Badge tone="neutral">{d?.establishments.total ?? 0} en total</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}