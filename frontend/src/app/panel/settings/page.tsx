"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Input, PageLoader, Textarea } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { Save } from "lucide-react";

interface EstablishmentProfile {
  establishment: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    category: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string;
    timezone: string;
    logoUrl: string | null;
    status: string;
  };
}

interface SubscriptionView {
  subscription: {
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    plan: { name: string; code: string; priceCents: number; currency: string } | null;
  } | null;
  usage: { customers: number; staff: number };
  limits: {
    customers: number | null;
    staff: number | null;
    customersExceeded: boolean;
    staffExceeded: boolean;
  } | null;
}

const SUB_STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" }> = {
  ACTIVE: { label: "Activa", tone: "green" },
  TRIALING: { label: "Prueba", tone: "green" },
  PAST_DUE: { label: "Pago pendiente", tone: "red" },
  CANCELED: { label: "Cancelada", tone: "red" },
};

export default function SettingsPage() {
  const { status } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => api.get<EstablishmentProfile>("/business/establishment"),
    enabled: status === "authed",
  });
  const subscriptionQuery = useQuery({
    queryKey: ["business-subscription"],
    queryFn: () => api.get<SubscriptionView>("/business/subscription"),
    enabled: status === "authed",
  });

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    address: "",
    city: "",
    province: "",
    timezone: "",
  });
  const [synced, setSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profileQuery.data && !synced) {
      const e = profileQuery.data.establishment;
      setForm({
        name: e.name,
        category: e.category ?? "",
        description: e.description ?? "",
        address: e.address ?? "",
        city: e.city ?? "",
        province: e.province ?? "",
        timezone: e.timezone,
      });
      setSynced(true);
    }
  }, [profileQuery.data, synced]);

  if (status === "loading" || (status === "authed" && (profileQuery.isLoading || subscriptionQuery.isLoading)))
    return <PageLoader />;
  if (profileQuery.isError) return <Alert tone="error">{errorMessage(profileQuery.error)}</Alert>;

  const sub = subscriptionQuery.data;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch("/business/establishment", {
        name: form.name.trim(),
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
      });
      setMessage({ tone: "success", text: "Perfil actualizado." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const plan = sub?.subscription?.plan;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Ajustes</h1>
        <p className="mt-1 text-sm text-ink-600">Perfil público del local y tu suscripción.</p>
      </div>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Perfil */}
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Datos del local</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Categoría" placeholder="Ej: café, bar" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <div className="sm:col-span-2">
              <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input label="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="Provincia" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            <Input label="Zona horaria" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> Guardar cambios
            </Button>
          </div>
        </Card>

        {/* Suscripción */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">Suscripción</h2>
              {sub?.subscription && (
                <Badge tone={SUB_STATUS[sub.subscription.status]?.tone ?? "amber"}>
                  {SUB_STATUS[sub.subscription.status]?.label ?? sub.subscription.status}
                </Badge>
              )}
            </div>
            {plan ? (
              <div className="mt-4">
                <p className="text-lg font-bold text-ink-950">{plan.name}</p>
                <p className="text-sm text-ink-600">{plan.code}</p>
                {sub?.subscription?.trialEndsAt && sub.subscription.status === "TRIALING" && (
                  <p className="mt-2 text-sm text-ink-700">Prueba hasta el {formatDate(sub.subscription.trialEndsAt)}</p>
                )}
                {sub?.subscription?.currentPeriodEnd && sub.subscription.status !== "TRIALING" && (
                  <p className="mt-2 text-sm text-ink-700">Renueva el {formatDate(sub.subscription.currentPeriodEnd)}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-600">Sin plan asignado.</p>
            )}
          </Card>

          {sub && (
            <Card>
              <h2 className="text-sm font-semibold text-ink-900">Uso del plan</h2>
              <div className="mt-4 space-y-3">
                <UsageRow
                  label="Clientes"
                  usage={sub.usage.customers}
                  limit={sub.limits?.customers ?? null}
                  exceeded={sub.limits?.customersExceeded ?? false}
                />
                <UsageRow
                  label="Equipo"
                  usage={sub.usage.staff}
                  limit={sub.limits?.staff ?? null}
                  exceeded={sub.limits?.staffExceeded ?? false}
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageRow({ label, usage, limit, exceeded }: { label: string; usage: number; limit: number | null; exceeded: boolean }) {
  const pct = limit ? Math.min(100, (usage / limit) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-700">{label}</span>
        <span className={exceeded ? "font-semibold text-red-600" : "font-semibold text-ink-950"}>
          {usage}{limit != null ? ` / ${limit}` : ""}
        </span>
      </div>
      {limit != null && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className={`h-full rounded-full ${exceeded ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {exceeded && <p className="mt-1 text-xs text-red-600">Superaste el límite de tu plan.</p>}
    </div>
  );
}