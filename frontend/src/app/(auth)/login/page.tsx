"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Button, Card, Input, Logo } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth-context";
import { KeyRound, Mail, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

function LoginForm() {
  const { login, sendMagicCode, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  const [mode, setMode] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goAfterLogin(authedUser = user) {
    if (next && next.startsWith("/")) {
      router.push(next);
    } else if (authedUser) {
      router.push(homeFor(authedUser));
    } else {
      router.push("/cards");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "password") {
        const u = await login(email, password);
        await goAfterLogin(u);
      } else {
        const res = await sendMagicCode(email);
        setDevCode(res.devCode ?? null);
        router.push(`/verify?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-ink-950">{mode === "password" ? "Ingresá a tu cuenta" : "Entrá con tu email"}</h1>
        <p className="mt-1 text-sm text-ink-600">
          {mode === "password" ? "Dueños, personal y clientes entran por acá" : "Te enviamos un código de 6 dígitos"}
        </p>
      </div>

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {devCode && (
        <Alert tone="info" className="mb-4">
          Modo desarrollo: tu código es <strong className="font-mono">{devCode}</strong>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="vos@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode === "password" && (
          <Input
            label="Contraseña"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <Button type="submit" loading={loading} className="w-full" size="lg">
          {mode === "password" ? (
            <>
              <KeyRound className="h-4 w-4" /> Entrar
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" /> Enviar código
            </>
          )}
        </Button>
      </form>

      <div className="mt-5 border-t border-ink-200 pt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "password" ? "code" : "password");
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          {mode === "password" ? (
            <>
              <Sparkles className="h-4 w-4" /> Prefiero entrar con un código por email
            </>
          ) : (
            "Usar email y contraseña"
          )}
        </button>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-brand-50/40 px-4">
      <Link href="/">
        <Logo />
      </Link>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="max-w-sm text-center text-xs text-ink-600">
        Al ingresar aceptás los términos de uso de Tarjetas.app. Tus datos se guardan cifrados.
      </p>
    </div>
  );
}