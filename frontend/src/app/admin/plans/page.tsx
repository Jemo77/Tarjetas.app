"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input, Modal, PageLoader, Select } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPeso } from "@/lib/format";
import { Plus, Pencil } from "lucide-react";

interface Plan {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  maxCustomers: number | null;
  maxStaff: number | null;
  features: Record<string, unknown>;
  isActive: boolean;
}

interface PlansResponse {
  plans: Plan[];
}

const EMPTY_FORM = {
  code: "",
  name: "",
  priceCents: "",
  maxCustomers: "",
  maxStaff: "",
};

export default function AdminPlansPage() {
  const { status } = useAuth();
  const qc = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => api.get<PlansResponse>("/admin/plans"),
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;
  const plans = query.data?.plans ?? [];

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setCreating(false);
    setForm({
      code: plan.code,
      name: plan.name,
      priceCents: String(plan.priceCents),
      maxCustomers: plan.maxCustomers != null ? String(plan.maxCustomers) : "",
      maxStaff: plan.maxStaff != null ? String(plan.maxStaff) : "",
    });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      priceCents: Number(form.priceCents),
      maxCustomers: form.maxCustomers === "" ? null : Number(form.maxCustomers),
      maxStaff: form.maxStaff === "" ? null : Number(form.maxStaff),
    };
    try {
      if (editing) {
        await api.patch(`/admin/plans/${editing.id}`, body);
      } else {
        await api.post("/admin/plans", body);
      }
      setCreating(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">Planes</h1>
          <p className="mt-1 text-sm text-ink-600">Planes de suscripción disponibles para los locales.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Crear plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-ink-950">{plan.name}</h2>
                <p className="font-mono text-xs text-ink-600">{plan.code}</p>
              </div>
              <Badge tone={plan.isActive ? "green" : "neutral"}>{plan.isActive ? "Activo" : "Inactivo"}</Badge>
            </div>
            <p className="mt-3 text-2xl font-bold text-ink-950">
              {formatPeso(plan.priceCents, plan.currency)}
              <span className="text-sm font-normal text-ink-600">/{plan.interval === "YEARLY" ? "año" : "mes"}</span>
            </p>
            <div className="mt-3 space-y-1 text-sm text-ink-700">
              <p>{plan.maxCustomers != null ? `Hasta ${plan.maxCustomers} clientes` : "Clientes ilimitados"}</p>
              <p>{plan.maxStaff != null ? `Hasta ${plan.maxStaff} miembros` : "Equipo ilimitado"}</p>
            </div>
            <div className="mt-4 flex justify-end border-t border-ink-100 pt-3">
              <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {(creating || editing) && (
        <Modal title={editing ? `Editar: ${editing.name}` : "Crear plan"} onClose={() => { setCreating(false); setEditing(null); }}>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Código *" placeholder="pro" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input label="Nombre *" placeholder="Profesional" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Precio (centavos) *" type="number" min={0} value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} />
              <Input label="Máx. clientes" type="number" min={1} placeholder="Ilimitado" value={form.maxCustomers} onChange={(e) => setForm({ ...form, maxCustomers: e.target.value })} />
              <Input label="Máx. equipo" type="number" min={1} placeholder="Ilimitado" value={form.maxStaff} onChange={(e) => setForm({ ...form, maxStaff: e.target.value })} />
            </div>
            <p className="text-xs text-ink-600">El precio se expresa en centavos (ej: 15000 = {formatPeso(15000)}).</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</Button>
              <Button type="submit" className="flex-1" loading={busy}>{editing ? "Guardar" : "Crear"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}