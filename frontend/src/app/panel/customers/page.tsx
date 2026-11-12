"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Button, Input, PageLoader, Select } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface CustomerRow {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  totalStamps: number;
  totalCardsCompleted: number;
  totalRewardsRedeemed: number;
  firstStampDate: string | null;
  lastStampDate: string | null;
  visitsLast30d: number;
  avgDaysBetweenVisits: number | null;
  segment: string;
}

interface CustomersResponse {
  items: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  segments: Record<string, number>;
}

const SEGMENT_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "brand"> = {
  NEW: "blue",
  ACTIVE: "green",
  LOYAL: "brand",
  AT_RISK: "amber",
  LOST: "red",
};

const SEGMENT_LABEL: Record<string, string> = {
  NEW: "Nuevo",
  ACTIVE: "Activo",
  LOYAL: "Leal",
  AT_RISK: "En riesgo",
  LOST: "Perdido",
};

export default function CustomersPage() {
  const { status } = useAuth();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [segment, setSegment] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["business-customers", { search, segment, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (segment) params.set("segment", segment);
      params.set("page", String(page));
      params.set("pageSize", "20");
      return api.get<CustomersResponse>(`/business/customers?${params.toString()}`);
    },
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;
  const data = query.data;

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Clientes</h1>
        <p className="mt-1 text-sm text-ink-600">Todos los que sumaron sellos en este local.</p>
      </div>

      <form onSubmit={applySearch} className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Input
            label="Buscar"
            placeholder="Nombre o email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select label="Segmento" value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            {Object.entries(SEGMENT_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" /> Buscar
        </Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Sellos</th>
              <th className="px-4 py-3 font-medium">Premios</th>
              <th className="px-4 py-3 font-medium">Última visita</th>
              <th className="px-4 py-3 font-medium">Segmento</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-600">
                  No hay clientes que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {data?.items.map((c) => (
              <tr key={c.userId} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                <td className="px-4 py-3">
                  <Link href={`/panel/customers/${c.userId}`} className="font-medium text-ink-950 hover:text-brand-700">
                    {c.name ?? "Sin nombre"}
                  </Link>
                  <p className="text-xs text-ink-600">{c.email}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-ink-950">{c.totalStamps}</td>
                <td className="px-4 py-3 text-ink-700">
                  {c.totalCardsCompleted} completas · {c.totalRewardsRedeemed} canjeados
                </td>
                <td className="px-4 py-3 text-ink-700">{c.lastStampDate ? formatDate(c.lastStampDate) : "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={SEGMENT_TONE[c.segment] ?? "neutral"}>{SEGMENT_LABEL[c.segment] ?? c.segment}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3 text-sm text-ink-700">
            <span>
              Página {data.page} de {data.totalPages} · {data.total} clientes
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}