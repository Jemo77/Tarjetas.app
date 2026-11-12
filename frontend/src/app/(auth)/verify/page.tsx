"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Input, Logo } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth-context";

function VerifyForm() {
  const { verifyCode } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const next = searchParams.get("next") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const { sendMagicCode } = useAuth();
  const sent = useRef(email.length > 0);

  useEffect(() => {
    if (!sent.current && email) {
      sent.current = true;
      void sendMagicCode(email).catch(() => undefined);
    }
  }, [email, sendMagicCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await verifyCode(email, code);
      if (next && next.startsWith("/")) router.push(next);
      else router.push(homeFor(u));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    try {
      await sendMagicCode(email);
      setResent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-ink-950">Verificá tu email</h1>
        <p className="mt-1 text-sm text-ink-600">
          Enviamos un código de 6 dígitos a <strong>{email || "tu email"}</strong>
        </p>
      </div>

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {resent && <Alert tone="success" className="mb-4">Te reenviamos el código.</Alert>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          placeholder="000000"
          className="text-center font-mono text-2xl tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <Button type="submit" loading={loading} className="w-full" size="lg" disabled={code.length !== 6}>
          Verificar y entrar
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-600">
        ¿No te llegó?{" "}
        <button type="button" className="font-medium text-brand-700 hover:underline" onClick={resend}>
          Reenviar código
        </button>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link href="/login" className="font-medium text-ink-700 hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-brand-50/40 px-4">
      <Link href="/">
        <Logo />
      </Link>
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}