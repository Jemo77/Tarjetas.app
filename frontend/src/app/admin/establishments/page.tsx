"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input, Modal, PageLoader, Select } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { Plus, Search, Ban, PlayCircle, UserPlus, Eye, Copy } from "lucide-react";

interface EstablishmentRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  city: string | null;
  status: string;
  createdAt: string;
  subscription: { plan: { name: string; code: string; priceCents: number } } | null;
  _count: { members: number; cards: number; stamps: number; stats: number };
}

interface EstablishmentsResponse {
  items: EstablishmentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "brand"> = {
  ACTIVE: "green",
  PENDING: "amber",
  SUSPENDED: "red",
};

export default function AdminEstablishmentsPage() {
  const { status, impersonate } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState<EstablishmentRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-establishments", { search, statusFilter, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", "20");
      return api.get<EstablishmentsResponse>(`/admin/establishments?${params.toString()}`);
    },
    enabled: status === "authed",
  });

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function setStatus(row: EstablishmentRow, next: "ACTIVE" | "SUSPENDED") {
    setError(null);
    try {
      await api.post(`/admin/establishments/${row.id}/${next === "SUSPENDED" ? "suspend" : "activate"}`);
      qc.invalidateQueries({ queryKey: ["admin-establishments"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function doImpersonate(row: EstablishmentRow) {
    setError(null);
    try {
      await impersonate(row.id);
      window.location.href = "/panel";
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviting || !inviteEmail.trim()) return;
    setError(null);
    setInviteResult(null);
    try {
      const res = await api.post<{ ok: boolean; invitationUrl: string; expiresIn: number }>(
        `/admin/establishments/${inviting.id}/invite-owner`,
        { email: inviteEmail.trim() },
      );
      setInviteResult(res.invitationUrl);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">Locales</h1>
          <p className="mt-1 text-sm text-ink-600">Alta, suspensión y soporte de los negocios.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Crear local
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={applySearch} className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Input label="Buscar" placeholder="Nombre o slug…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <div className="w-44">
          <Select label="Estado" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="PENDING">Pendientes</option>
            <option value="SUSPENDED">Suspendidos</option>
          </Select>
        </div>
        <Button type="submit" variant="outline"><Search className="h-4 w-4" /> Buscar</Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Datos</th>
              <th className="px-4 py-3 font-medium">Alta</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-600">No hay locales.</td></tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-950">{row.name}</p>
                  <p className="text-xs text-ink-600">/{row.slug}{row.category ? ` · ${row.category}` : ""}{row.city ? ` · ${row.city}` : ""}</p>
                </td>
                <td className="px-4 py-3 text-ink-700">{row.subscription?.plan.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-700">
                  {row._count.stats} clientes · {row._count.stamps} sellos · {row._count.members} miembros
                </td>
                <td className="px-4 py-3 text-ink-700">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton title="Entrar como dueño (soporte)" onClick={() => doImpersonate(row)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton title="Invitar dueño" onClick={() => { setInviting(row); setInviteEmail(""); setInviteResult(null); }}>
                      <UserPlus className="h-4 w-4" />
                    </IconButton>
                    {row.status === "ACTIVE" ? (
                      <IconButton title="Suspender" danger onClick={() => setStatus(row, "SUSPENDED")}>
                        <Ban className="h-4 w-4" />
                      </IconButton>
                    ) : (
                      <IconButton title="Activar" onClick={() => setStatus(row, "ACTIVE")}>
                        <PlayCircle className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3 text-sm text-ink-700">
            <span>Página {data.page} de {data.totalPages} · {data.total} locales</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      {creating && (
        <CreateEstablishmentModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["admin-establishments"] });
            qc.invalidateQueries({ queryKey: ["admin-analytics"] });
          }}
        />
      )}

      {inviting && (
        <Modal title={`Invitar dueño: ${inviting.name}`} onClose={() => setInviting(null)}>
          <form onSubmit={sendInvite} className="space-y-4">
            <Input label="Email del dueño" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            {inviteResult && (
              <Alert tone="info">
                Invitación creada. Link (solo dev):{" "}
                <button type="button" className="inline-flex items-center gap-1 font-mono text-xs underline" onClick={() => navigator.clipboard?.writeText(inviteResult)}>
                  {inviteResult} <Copy className="h-3 w-3" />
                </button>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setInviting(null)}>Cancelar</Button>
              <Button type="submit" className="flex-1">Enviar invitación</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        danger ? "text-red-600 hover:bg-red-50" : "text-ink-700 hover:bg-ink-100"
      }`}
    >
      {children}
    </button>
  );
}

function CreateEstablishmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", category: "", city: "", stampsRequired: "10", rewardTitle: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/admin/establishments", {
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        city: form.city.trim() || undefined,
        stampsRequired: Number(form.stampsRequired),
        rewardTitle: form.rewardTitle.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Crear local" onClose={onClose}>
      <form onSubmit={create} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Nombre *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Categoría" placeholder="café, bar…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input label="Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Sellos para el premio" type="number" min={3} max={50} value={form.stampsRequired} onChange={(e) => setForm({ ...form, stampsRequired: e.target.value })} />
          <Input label="Premio inicial" placeholder="Ej: café gratis" value={form.rewardTitle} onChange={(e) => setForm({ ...form, rewardTitle: e.target.value })} />
        </div>
        <Alert tone="info">Se crea con QR, tarjeta por defecto y 14 días de prueba. Después invitás al dueño.</Alert>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={busy}>Crear local</Button>
        </div>
      </form>
    </Modal>
  );
}