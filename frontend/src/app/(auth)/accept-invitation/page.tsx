"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Button, Card, Input, Logo } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { SessionUser } from "@/lib/types";
import { homeFor, useAuth } from "@/lib/auth-context";

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { applySession } = useAuth();
  const token = searchParams.get("token") ?? "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ user: SessionUser }>("/auth/accept-invitation", {
        token,
        name,
        password,
      });
      applySession(res.user);
      router.push(homeFor(res.user));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <Alert tone="error" className="mb-4">
          El enlace de invitación es inválido o está incompleto. Pedile que te lo reenvíen.
        </Alert>
        <div className="text-center">
          <Link href="/login" className="text-sm font-medium text-brand-700 hover:underline">
            Volver a ingresar
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-ink-950">Aceptá tu invitación</h1>
        <p className="mt-1 text-sm text-ink-600">
          Te invitaron a administrar un emprendimiento. Cargá tus datos para crear la cuenta.
        </p>
      </div>

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Tu nombre"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Ej: Lucía Fernández"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Contraseña"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          placeholder="Mínimo 8 caracteres"
          hint="Usá una contraseña segura que no uses en otros sitios."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Crear cuenta y entrar
        </Button>
      </form>
    </Card>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-brand-50/40 px-4">
      <Link href="/">
        <Logo />
      </Link>
      <Suspense fallback={null}>
        <AcceptInvitationForm />
      </Suspense>
      <p className="max-w-sm text-center text-xs text-ink-600">
        Al ingresar aceptás los términos de uso de Tarjetas.app.
      </p>
    </div>
  );
}
