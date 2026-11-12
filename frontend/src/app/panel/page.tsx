"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, PageLoader, StatCard } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Overview {
  customers: {
    total: number;
    newThisWeek: number;
    newThisMonth: number;
    returnRate: number;
    avgDaysBetweenVisits: number | null;
  };
  activity: { stampsToday: number; stampsLast30d: number };
  rewards: {
    initiated: number;
    completed: number;
    conversionRate: number;
    redeemed: number;
    expired: number;
    pending: number;
  };
  segments: Record<string, number>;
  team: { staffId: string; name: string; stamps: number }[];
}

interface SubscriptionView {
  subscription: {
    status: string;
    trialEndsAt: string | null;
    plan: {
      name: string;
      code: string;
      priceCents: number;
      currency: string;
    } | null;
  } | null;
  usage: { customers: number; staff: number };
  limits: {
    customers: number | null;
    staff: number | null;
    customersExceeded: boolean;
    staffExceeded: boolean;
  } | null;
}

const SEGMENT_LABEL: Record<string, string> = {
  NEW: "Nuevos",
  ACTIVE: "Activos",
  LOYAL: "Leales",
  AT_RISK: "En riesgo",
  LOST: "Perdidos",
};

export default function PanelOverviewPage() {
  const { status } = useAuth();

  const overview = useQuery({
    queryKey: ["business-overview"],
    queryFn: () => api.get<Overview>("/business/analytics/overview"),
    enabled: status === "authed",
  });
  const subscription = useQuery({
    queryKey: ["business-subscription"],
    queryFn: () => api.get<SubscriptionView>("/business/subscription"),
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && (overview.isLoading || subscription.isLoading)))
    return <PageLoader />;
  if (overview.isError) return <Alert tone="error">{errorMessage(overview.error)}</Alert>;
  if (!overview.data) return null;

  const o = overview.data;
  const sub = subscription.data?.subscription;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">Resumen del local</h1>
          <p className="mt-1 text-sm text-ink-600">Cómo va tu programa de fidelidad hoy.</p>
        </div>
        {sub && <Badge tone={sub.status === "ACTIVE" || sub.status === "TRIALING" ? "green" : "amber"}>{subscriptionStatus(sub.status).label}</Badge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes" value={o.customers.total} sub={`+${o.customers.newThisWeek} esta semana`} accent />
        <StatCard
          label="Sellos hoy"
          value={o.activity.stampsToday}
          sub={`${o.activity.stampsLast30d} en los últimos 30 días`}
        />
        <StatCard
          label="Tasa de retorno"
          value={`${o.customers.returnRate}%`}
          sub={o.customers.avgDaysBetweenVisits != null ? `Vuelven cada ~${o.customers.avgDaysBetweenVisits} días` : "Aún sin datos"}
        />
        <StatCard
          label="Premios canjeados"
          value={o.rewards.redeemed}
          sub={`${o.rewards.pending} pendientes de canjear`}
        />
      </div>

      {/* Conversión */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Embudo de premios</h2>
          <p className="mt-1 text-xs text-ink-600">
            De tarjetas iniciadas a premios canjeados.
          </p>
          <div className="mt-5 space-y-3">
            <FunnelRow label="Tarjetas iniciadas" value={o.rewards.initiated} />
            <FunnelRow label="Tarjetas completas" value={o.rewards.completed} pct={o.rewards.conversionRate} />
            <FunnelRow label="Premios canjeados" value={o.rewards.redeemed} />
            <FunnelRow label="Premios vencidos" value={o.rewards.expired} />
          </div>
        </section>

        <section className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Segmentos de clientes</h2>
          <p className="mt-1 text-xs text-ink-600">Según frecuencia de visitas.</p>
          <div className="mt-5 space-y-3">
            {Object.entries(o.segments).length === 0 && (
              <p className="text-sm text-ink-600">Todavía no hay clientes con sellos.</p>
            )}
            {Object.entries(o.segments).map(([seg, count]) => (
              <div key={seg} className="flex items-center gap-3">
                <span className="w-24 text-sm text-ink-700">{SEGMENT_LABEL[seg] ?? seg}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${o.customers.total ? (count / o.customers.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-semibold text-ink-900">{count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Equipo */}
      {o.team.length > 0 && (
        <section className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Sellos por personal (30 días)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-600">
                  <th className="py-2 pr-4 font-medium">Persona</th>
                  <th className="py-2 font-medium">Sellos</th>
                </tr>
              </thead>
              <tbody>
                {o.team.map((t) => (
                  <tr key={t.staffId} className="border-b border-ink-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-ink-900">{t.name}</td>
                    <td className="py-2.5 text-ink-700">{t.stamps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function FunnelRow({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-700">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-950">
        {value}
        {pct !== undefined && <Badge tone="brand">{pct}%</Badge>}
      </span>
    </div>
  );
}

function subscriptionStatus(status: string): { label: string; tone: "green" | "amber" | "red" } {
  const labels: Record<string, { label: string; tone: "green" | "amber" | "red" }> = {
    ACTIVE: { label: "Suscripción activa", tone: "green" },
    TRIALING: { label: "Período de prueba", tone: "green" },
    PAST_DUE: { label: "Pago pendiente", tone: "red" },
    CANCELED: { label: "Suscripción cancelada", tone: "red" },
  };
  return labels[status] ?? { label: status, tone: "amber" };
}