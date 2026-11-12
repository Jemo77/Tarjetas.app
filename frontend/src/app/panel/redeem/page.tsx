"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Input, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { Gift, QrCode, ScanLine, KeyRound, CheckCircle2 } from "lucide-react";

interface RedeemPreview {
  card: {
    id: string;
    cycle: number;
    rewardTitle: string;
    rewardDescription: string | null;
    customer: { id: string; name: string | null; email: string } | null;
    redeemCode: string;
    completedAt: string | null;
  };
}

interface Redeemed {
  ok: boolean;
  redeemed: {
    customer: { name: string | null; email: string } | null;
    rewardTitle: string;
    code: string;
    redeemedAt: string;
  };
}

export default function RedeemPage() {
  const { status } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"code" | "scan">("code");
  const [code, setCode] = useState("");
  const [mounted, setMounted] = useState(false);

  const [preview, setPreview] = useState<RedeemPreview | null>(null);
  const [activePayload, setActivePayload] = useState<{ code?: string; token?: string } | null>(null);
  const [done, setDone] = useState<Redeemed["redeemed"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  if (status === "loading") return <PageLoader />;

  async function lookup(payload: { code?: string; token?: string }) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await api.post<RedeemPreview>("/business/redemptions/preview", payload);
      setPreview(res);
      setActivePayload(payload);
    } catch (err) {
      setError(errorMessage(err));
      setPreview(null);
      setActivePayload(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview || !activePayload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<Redeemed>("/business/redemptions", activePayload);
      setDone(res.redeemed);
      setPreview(null);
      setActivePayload(null);
      setCode("");
      qc.invalidateQueries();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onScan(detected: { rawValue?: string }[]) {
    const raw = detected[0]?.rawValue;
    if (!raw) return;
    // Puede venir el link completo /panel/redeem?token=... o solo el token
    let token: string | null = null;
    try {
      const url = new URL(raw);
      token = url.searchParams.get("token");
    } catch {
      token = raw;
    }
    if (token) lookup({ token });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Canjear premio</h1>
        <p className="mt-1 text-sm text-ink-600">
          Escaneá el QR del cliente o ingresá su código para entregarle el premio.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {done && (
        <Alert tone="success">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-semibold">
                ¡Premio entregado! {done.customer?.name ? `Para ${done.customer.name}.` : ""}
              </p>
              <p className="text-emerald-800">
                {done.rewardTitle} · código {done.code} · {formatDate(done.redeemedAt)}
              </p>
            </div>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
            <button
              onClick={() => setTab("code")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === "code" ? "bg-white text-ink-950 shadow-sm" : "text-ink-700"}`}
            >
              <KeyRound className="mr-1 inline h-4 w-4" /> Código
            </button>
            <button
              onClick={() => setTab("scan")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === "scan" ? "bg-white text-ink-950 shadow-sm" : "text-ink-700"}`}
            >
              <ScanLine className="mr-1 inline h-4 w-4" /> Escanear QR
            </button>
          </div>

          <div className="mt-5">
            {tab === "code" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) lookup({ code: code.trim().toUpperCase() });
                }}
                className="space-y-4"
              >
                <Input
                  label="Código del premio"
                  placeholder="Ej: QWERTY"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase tracking-widest"
                  autoComplete="off"
                />
                <Button type="submit" loading={busy} className="w-full">
                  <Gift className="h-4 w-4" /> Buscar premio
                </Button>
              </form>
            ) : mounted ? (
              <div className="overflow-hidden rounded-2xl">
                <Scanner
                  onScan={onScan}
                  formats={["qr_code"]}
                  allowMultiple={false}
                  sound
                  components={{ finder: false }}
                  classNames={{ container: "w-full" }}
                />
              </div>
            ) : null}
          </div>
        </Card>

        {/* Resultado del preview */}
        <div>
          {preview ? (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Premio encontrado</p>
              <h2 className="mt-2 text-xl font-bold text-ink-950">{preview.card.rewardTitle}</h2>
              {preview.card.rewardDescription && (
                <p className="mt-1 text-sm text-ink-700">{preview.card.rewardDescription}</p>
              )}
              <div className="mt-4 space-y-1 text-sm text-ink-700">
                <p>Cliente: <strong>{preview.card.customer?.name ?? "Anónimo"}</strong></p>
                <p>Tarjeta ciclo #{preview.card.cycle} · código <strong className="font-mono">{preview.card.redeemCode}</strong></p>
                <p>Completada el {formatDate(preview.card.completedAt)}</p>
              </div>
              <Button className="mt-5 w-full" size="lg" onClick={confirm} loading={busy}>
                <Gift className="h-5 w-5" /> Confirmar entrega del premio
              </Button>
            </Card>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center">
              <QrCode className="h-10 w-10 text-ink-400" />
              <p className="mt-3 text-sm font-medium text-ink-900">Buscá un premio primero</p>
              <p className="mt-1 max-w-xs text-sm text-ink-600">
                El cliente te muestra el QR o el código de su tarjeta completa y acá confirmás la entrega.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}