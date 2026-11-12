"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Input, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { Search } from "lucide-react";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
  establishment: { id: string; name: string } | null;
}

interface AuditResponse {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AdminAuditPage() {
  const { status } = useAuth();
  const [action, setAction] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-audit", { action, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      params.set("page", String(page));
      params.set("pageSize", "30");
      return api.get<AuditResponse>(`/admin/audit-logs?${params.toString()}`);
    },
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;
  const data = query.data;

  function apply(e: React.FormEvent) {
    e.preventDefault();
    setAction(actionInput.trim());
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Auditoría</h1>
        <p className="mt-1 text-sm text-ink-600">Registro de acciones sensibles de la plataforma.</p>
      </div>

      <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Input label="Filtrar por acción" placeholder="Ej: establishment.suspend" value={actionInput} onChange={(e) => setActionInput(e.target.value)} />
        </div>
        <Button type="submit" variant="outline"><Search className="h-4 w-4" /> Filtrar</Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Entidad</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-600">Sin registros.</td></tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                <td className="px-4 py-3 whitespace-nowrap text-ink-700">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-950">{row.actor?.name ?? "Sistema"}</p>
                  {row.actor && <p className="text-xs text-ink-600">{row.actor.email}</p>}
                </td>
                <td className="px-4 py-3 text-ink-700">{row.establishment?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone="neutral">{row.action}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-700">
                  {row.entity}
                  {row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3 text-sm text-ink-700">
            <span>Página {data.page} de {data.totalPages} · {data.total} registros</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}