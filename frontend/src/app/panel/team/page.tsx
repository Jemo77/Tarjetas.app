"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input, PageLoader, Select } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { UserPlus, Trash2, ShieldCheck } from "lucide-react";

interface Member {
  id: string;
  isActive: boolean;
  role: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null; lastLoginAt: string | null };
  stampPoints: { id: string; token: string; label: string }[];
}

interface MembersResponse {
  members: Member[];
  pendingInvitations: { id: string; email: string; role: string; createdAt: string }[];
}

const ROLE_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "brand"> = {
  OWNER: "brand",
  MANAGER: "blue",
  STAFF: "neutral",
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dueño/a",
  MANAGER: "Encargado/a",
  STAFF: "Personal",
};

export default function TeamPage() {
  const { status, user } = useAuth();
  const qc = useQueryClient();
  const role = user?.memberships?.[0]?.role;
  const canManage = role === "OWNER" || role === "MANAGER";

  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState("STAFF");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["members"],
    queryFn: () => api.get<MembersResponse>("/business/members"),
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;
  const { members, pendingInvitations } = query.data ?? { members: [], pendingInvitations: [] };

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.post<{ ok: boolean; created: boolean; invitationUrl?: string }>("/business/members", {
        email: email.trim(),
        role: newRole,
      });
      setEmail("");
      setInfo(
        res.created
          ? "Invitación enviada por email. Se une al equipo cuando la acepte."
          : "Miembro agregado al equipo.",
      );
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(memberId: string, nextRole: string) {
    setError(null);
    setInfo(null);
    try {
      await api.patch(`/business/members/${memberId}`, { role: nextRole });
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("¿Quitás a esta persona del equipo?")) return;
    setError(null);
    setInfo(null);
    try {
      await api.del(`/business/members/${memberId}`);
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Equipo</h1>
        <p className="mt-1 text-sm text-ink-600">Personas que pueden operar el programa en el local.</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      {canManage ? (
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Agregar miembro</h2>
          <p className="mt-1 text-xs text-ink-600">
            Si la persona ya tiene cuenta, se suma al instante. Si no, recibe una invitación por email.
          </p>
          <form onSubmit={addMember} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <Input label="Email" type="email" required placeholder="equipo@local.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="w-44">
              <Select label="Rol" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="STAFF">Personal</option>
                <option value="MANAGER">Encargado/a</option>
                <option value="OWNER">Dueño/a</option>
              </Select>
            </div>
            <Button type="submit" loading={adding}>
              <UserPlus className="h-4 w-4" /> Agregar
            </Button>
          </form>
        </Card>
      ) : (
        <Alert tone="info">Solo el dueño o un encargado puede administrar el equipo.</Alert>
      )}

      {/* Miembros */}
      <Card>
        <h2 className="text-sm font-semibold text-ink-900">Miembros ({members.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 pr-4 font-medium">Persona</th>
                <th className="py-2 pr-4 font-medium">Rol</th>
                <th className="py-2 pr-4 font-medium">Último acceso</th>
                <th className="py-2 pr-4 font-medium">QR propio</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-ink-100 last:border-0">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-ink-950">{m.user.name ?? "Sin nombre"}</p>
                    <p className="text-xs text-ink-600">{m.user.email}</p>
                  </td>
                  <td className="py-2.5 pr-4">
                    {canManage && m.user.id !== user?.id ? (
                      <Select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        className="w-36 py-1.5 text-xs"
                      >
                        <option value="OWNER">Dueño/a</option>
                        <option value="MANAGER">Encargado/a</option>
                        <option value="STAFF">Personal</option>
                      </Select>
                    ) : (
                      <Badge tone={ROLE_TONE[m.role] ?? "neutral"}>
                        {ROLE_LABEL[m.role] ?? m.role}
                        {m.user.id === user?.id && <ShieldCheck className="ml-1 inline h-3 w-3" />}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-ink-700">{m.user.lastLoginAt ? formatDate(m.user.lastLoginAt) : "Nunca"}</td>
                  <td className="py-2.5 pr-4">
                    {m.stampPoints.length > 0 ? (
                      <span className="font-mono text-xs text-ink-700">{m.stampPoints[0]?.label}</span>
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {canManage && m.user.id !== user?.id && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invitaciones pendientes */}
      {pendingInvitations.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Invitaciones pendientes</h2>
          <div className="mt-3 space-y-2">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3 text-sm">
                <span className="text-ink-900">{inv.email}</span>
                <Badge tone="amber">{ROLE_LABEL[inv.role] ?? inv.role} · pendiente</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}