"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, Input, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { SessionUser } from "@/lib/types";
import { ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  const { user, status, refetch } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMessage, setPassMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [changingPass, setChangingPass] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.patch<{ user: SessionUser }>("/me", {
        name: name || undefined,
        phone: phone || undefined,
        twoFactorEnabled: twoFactor,
      });
      await refetch();
      setMessage({ tone: "success", text: "Perfil actualizado. " + (twoFactor ? "2FA activado." : "") });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPass(true);
    setPassMessage(null);
    try {
      await api.post("/me/change-password", { currentPassword: current, newPassword: newPass });
      setCurrent("");
      setNewPass("");
      setPassMessage({ tone: "success", text: "Contraseña actualizada." });
    } catch (err) {
      setPassMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setChangingPass(false);
    }
  }

  if (status === "loading") return <PageLoader />;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Tu perfil</h1>
        <p className="mt-1 text-sm text-ink-600">Datos de tu cuenta de cliente o de negocio.</p>
      </div>

      {message && (
        <Alert tone={message.tone === "success" ? "success" : "error"}>{message.text}</Alert>
      )}

      <Card>
        <h2 className="mb-4 font-semibold text-ink-950">Información personal</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <Input label="Email (no editable)" type="email" value={user?.email ?? ""} disabled />
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo te llaman" />
          <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 ..." inputMode="tel" />
          <label className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
            <input
              type="checkbox"
              checked={twoFactor}
              onChange={(e) => {
                setTwoFactor(e.target.checked);
                // Al activar 2FA se te pedirá un código por email además de la contraseña.
              }}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-sm text-ink-800">
              <span className="font-medium">Doble factor (2FA)</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-600">
                <ShieldCheck className="h-3.5 w-3.5" /> Pediremos un código por email al entrar
              </span>
            </span>
          </label>
          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-ink-950">Cambiar contraseña</h2>
        {passMessage && <Alert tone={passMessage.tone === "success" ? "success" : "error"} className="mb-4">{passMessage.text}</Alert>}
        <form onSubmit={changePassword} className="space-y-4">
          <Input label="Contraseña actual" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          <Input label="Nueva contraseña" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" minLength={8} required />
          <Button type="submit" variant="secondary" loading={changingPass}>
            Actualizar contraseña
          </Button>
        </form>
      </Card>
    </div>
  );
}