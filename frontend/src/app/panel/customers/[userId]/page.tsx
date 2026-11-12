"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input, PageLoader, Textarea } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatDateOnly } from "@/lib/format";
import { Stamp, RotateCcw, ChevronLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface CustomerDetail {
  customer: {
    userId: string;
    totalStamps: number;
    totalCardsCompleted: number;
    totalRewardsRedeemed: number;
    firstStampDate: string | null;
    lastStampDate: string | null;
    visitsLast30d: number;
    avgDaysBetweenVisits: number | null;
    segment: string;
    user: { id: string; name: string | null; email: string; phone: string | null; avatarUrl: string | null };
  };
  cards: {
    id: string;
    cycle: number;
    status: string;
    stampsCount: number;
    stampsRequired: number;
    rewardTitle: string;
    completedAt: string | null;
    redeemedAt: string | null;
    expiresAt: string | null;
  }[];
  recentStamps: {
    id: string;
    status: string;
    source: string;
    stampDate: string;
    stampedAt: string;
    staff: { name: string | null } | null;
  }[];
}

const CARD_STATUS: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" | "brand" }> = {
  ACTIVE: { label: "En curso", tone: "blue" },
  COMPLETED: { label: "Completa", tone: "green" },
  REDEEMED: { label: "Canjeada", tone: "brand" },
  EXPIRED: { label: "Vencida", tone: "red" },
};

export default function CustomerDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { status } = useAuth();
  const qc = useQueryClient();

  const [note, setNote] = useState("");
  const [action, setAction] = useState<"stamp" | "void" | null>(null);
  const [stampId, setStampId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["business-customer", userId],
    queryFn: () => api.get<CustomerDetail>(`/business/customers/${userId}`),
    enabled: status === "authed" && !!userId,
  });

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError || !query.data) return <Alert tone="error">{errorMessage(query.error)}</Alert>;
  const { customer, cards, recentStamps } = query.data;

  async function addManualStamp() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.post("/business/stamps/manual", { userId, note: note.trim() || undefined });
      setInfo("Sello cargado correctamente. 🎉");
      setNote("");
      qc.invalidateQueries({ queryKey: ["business-customer", userId] });
      qc.invalidateQueries({ queryKey: ["business-customers"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function voidStamp() {
    if (!stampId || !reason.trim()) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.post(`/business/stamps/${stampId}/void`, { reason: reason.trim() });
      setInfo("Sello anulado.");
      setReason("");
      setStampId(null);
      qc.invalidateQueries({ queryKey: ["business-customer", userId] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/panel/customers" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Volver a clientes
        </Link>
        <h1 className="text-2xl font-bold text-ink-950">{customer.user.name ?? customer.user.email}</h1>
        <p className="mt-1 text-sm text-ink-600">
          {customer.user.email}
          {customer.user.phone ? ` · ${customer.user.phone}` : ""}
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sellos" value={customer.totalStamps} />
        <Stat label="Tarjetas completas" value={customer.totalCardsCompleted} />
        <Stat label="Premios canjeados" value={customer.totalRewardsRedeemed} />
        <Stat label="Última visita" value={customer.lastStampDate ? formatDateOnly(customer.lastStampDate) : "—"} />
      </div>

      {/* Carga manual */}
      <Card>
        <h2 className="text-sm font-semibold text-ink-900">Cargar un sello manual</h2>
        <p className="mt-1 text-xs text-ink-600">
          Para errores de escaneo o compras sin QR. Suma un sello del día, igual que el QR.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <div className="min-w-60 flex-1">
            <Input label="Nota (opcional)" placeholder="Ej: compra sin escanear" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button className="mt-5" onClick={addManualStamp} loading={busy}>
            <Stamp className="h-4 w-4" /> Sumar sello
          </Button>
        </div>
      </Card>

      {/* Tarjetas */}
      <Card>
        <h2 className="text-sm font-semibold text-ink-900">Tarjetas</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 pr-4 font-medium">Ciclo</th>
                <th className="py-2 pr-4 font-medium">Progreso</th>
                <th className="py-2 pr-4 font-medium">Premio</th>
                <th className="py-2 pr-4 font-medium">Vence</th>
                <th className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const st = CARD_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
                return (
                  <tr key={c.id} className="border-b border-ink-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-ink-900">#{c.cycle}</td>
                    <td className="py-2.5 pr-4 text-ink-700">{c.stampsCount}/{c.stampsRequired}</td>
                    <td className="py-2.5 pr-4 text-ink-700">{c.rewardTitle}</td>
                    <td className="py-2.5 pr-4 text-ink-700">{c.expiresAt ? formatDate(c.expiresAt) : "—"}</td>
                    <td className="py-2.5"><Badge tone={st.tone}>{st.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sellos recientes */}
      <Card>
        <h2 className="text-sm font-semibold text-ink-900">Sellos recientes</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Fuente</th>
                <th className="py-2 pr-4 font-medium">Cargado por</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {recentStamps.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-ink-600">Todavía no hay sellos.</td></tr>
              )}
              {recentStamps.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-0">
                  <td className="py-2.5 pr-4 text-ink-900">{formatDate(s.stampedAt)}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={s.status === "VOIDED" ? "red" : "neutral"}>{sourceLabel(s.source)}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-ink-700">{s.staff?.name ?? "—"}</td>
                  <td className="py-2.5 text-right">
                    {s.status !== "VOIDED" && (
                      <button
                        onClick={() => { setStampId(s.id); setReason(""); setAction("void"); }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de anulación */}
      {action === "void" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4" onClick={() => setAction(null)}>
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-ink-950">Anular sello</h2>
            <p className="mt-1 text-sm text-ink-600">El día queda bloqueado para este cliente en este local.</p>
            <div className="mt-4 space-y-3">
              <Textarea label="Motivo" required placeholder="Ej: carga duplicada" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAction(null)}>Cancelar</Button>
                <Button variant="danger" className="flex-1" onClick={voidStamp} loading={busy} disabled={!reason.trim()}>
                  Anular sello
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-950">{value}</p>
    </div>
  );
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = { QR: "QR", NFC: "NFC", MANUAL: "Manual" };
  return labels[source] ?? source;
}