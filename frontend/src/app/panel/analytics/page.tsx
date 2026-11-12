"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Card, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Retention {
  total: number;
  rows: { label: string; customers: number }[];
}

interface Heatmap {
  days: { day: string; dow: number; count: number }[];
}

const HEAT_COLORS = ["#f5f5f4", "#fed7aa", "#fdba74", "#fb923c", "#f06407", "#c74a08"];

export default function AnalyticsPage() {
  const { status } = useAuth();

  const retention = useQuery({
    queryKey: ["analytics-retention"],
    queryFn: () => api.get<Retention>("/business/analytics/retention"),
    enabled: status === "authed",
  });
  const heatmap = useQuery({
    queryKey: ["analytics-heatmap"],
    queryFn: () => api.get<Heatmap>("/business/analytics/weekday-heatmap"),
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && (retention.isLoading || heatmap.isLoading)))
    return <PageLoader />;
  if (retention.isError) return <Alert tone="error">{errorMessage(retention.error)}</Alert>;

  const ret = retention.data;
  const heat = heatmap.data;
  const maxHeat = Math.max(1, ...(heat?.days.map((d) => d.count) ?? [1]));
  const heatData = (heat?.days ?? []).map((d) => ({
    ...d,
    color: HEAT_COLORS[Math.floor((d.count / maxHeat) * (HEAT_COLORS.length - 1))],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Analytics</h1>
        <p className="mt-1 text-sm text-ink-600">Retención y hábitos de visita de tus clientes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Retención */}
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Retención por cantidad de sellos</h2>
          <p className="mt-1 text-xs text-ink-600">
            Cuántos clientes alcanzaron cada nivel de sellos. {ret?.total ?? 0} clientes en total.
          </p>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ret?.rows ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#78716c" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#78716c" }} />
                <Tooltip cursor={{ fill: "#f7f5f3" }} />
                <Bar dataKey="customers" name="Clientes" fill="#f06407" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Heatmap de días */}
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Sellos por día de la semana</h2>
          <p className="mt-1 text-xs text-ink-600">Últimas 12 semanas. ¿Cuándo tenés más tráfico?</p>
          <div className="mt-5 grid grid-cols-1 gap-2">
            {heatData.length === 0 && <p className="text-sm text-ink-600">Aún sin datos.</p>}
            {heatData.map((d) => (
              <div key={d.dow} className="flex items-center gap-3">
                <span className="w-24 text-sm text-ink-700">{d.day}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-lg" style={{ backgroundColor: d.color }} />
                <span className="w-12 text-right text-sm font-semibold text-ink-900">{d.count}</span>
              </div>
            ))}
          </div>
          {heatData.length > 0 && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-600">
              <span>Menos</span>
              {HEAT_COLORS.map((c) => (
                <span key={c} className="h-3 w-6 rounded" style={{ backgroundColor: c }} />
              ))}
              <span>Más</span>
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="brand">Retención: {ret ? percent(ret?.rows.find((r) => r.label === "10+ sellos")?.customers ?? 0, ret.total) : "—"}</Badge>
        {heat?.days.find((d) => d.dow === 0 || d.dow === 6)?.count ? (
          <Badge tone="neutral">Fin de semana concentran el tráfico</Badge>
        ) : null}
      </div>
    </div>
  );
}

function percent(part: number, total: number): string {
  if (!total) return "—";
  return `${Math.round((part / total) * 100)}% a +10 sellos`;
}