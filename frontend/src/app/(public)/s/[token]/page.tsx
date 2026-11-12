"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { use } from "react";
import { LoyaltyCard } from "@/components/loyalty-card";
import { Alert, Button, Logo, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ClaimResult, PublicStampPointInfo, WalletGroup } from "@/lib/types";
import { PartyPopper, ShieldCheck, Stamp } from "lucide-react";

function useProgress(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ["my-wallet"],
    queryFn: () => api.get<{ establishments: WalletGroup[] }>("/me/cards"),
    enabled: !!establishmentId,
  });
}

function ClaimInner() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const searchParams = useSearchParams();
  const src = searchParams.get("src") === "nfc" ? "nfc" : "qr";
  const { status: authStatus, user } = useAuth();

  const [claimError, setClaimError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ClaimResult | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const infoQuery = useQuery({
    queryKey: ["stamp-point", token],
    queryFn: () => api.get<PublicStampPointInfo>(`/public/stamp-points/${encodeURIComponent(token)}`),
    enabled: !!token,
    retry: false,
  });

  const isAuthed = authStatus === "authed";
  const walletQuery = useProgress(isAuthed ? infoQuery.data?.establishment.id : undefined);

  const walletGroup = walletQuery.data?.establishments.find((g) => g.establishment.id === infoQuery.data?.establishment.id);
  const progress = walletGroup?.activeCard;

  async function claim() {
    if (!token) return;
    setClaimError(null);
    setAlreadyDone(false);
    setClaiming(true);
    try {
      const result = await api.post<ClaimResult>("/stamps/claim", { token, src });
      setSuccess(result);
      walletQuery.refetch();
    } catch (err) {
      const message = errorMessage(err);
      if (message.includes("hoy") || (err as { code?: string })?.code === "ALREADY_STAMPED_TODAY") {
        setAlreadyDone(true);
        walletQuery.refetch();
      } else {
        setClaimError(message);
      }
    } finally {
      setClaiming(false);
    }
  }

  if (infoQuery.isLoading) return <PageLoader />;
  if (infoQuery.isError || !infoQuery.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo />
        <Alert tone="error">
          Este QR no corresponde a un local activo o ya no está vigente. Probá escanear de nuevo en el local.
        </Alert>
        <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const { establishment, template } = infoQuery.data;
  const stampsCount = progress?.stampsCount ?? 0;
  const stampsRequired = progress?.stampsRequired ?? template?.stampsRequired ?? 10;
  const displayCount = success ? success.card.stampsCount : stampsCount;

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50/60 via-white to-white px-4 pb-12">
      <div className="mx-auto flex max-w-md flex-col items-center pt-10">
        <Link href="/">
          <Logo />
        </Link>

        {/* Cabecera del local */}
        <div className="mt-8 flex w-full items-center gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
          {establishment.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={establishment.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-brand-100 text-2xl">🏠</span>
          )}
          <div>
            <h1 className="text-lg font-bold text-ink-950">{establishment.name}</h1>
            <p className="text-sm text-ink-600">
              {establishment.category ? `${establishment.category} · ` : ""}
              {[establishment.address, establishment.city].filter(Boolean).join(", ") || "Tarjeta de fidelidad"}
            </p>
          </div>
        </div>

        {/* Tarjeta */}
        <div className="mt-6 w-full">
          {progress || infoQuery.data?.establishment.active ? (
            <LoyaltyCard
              template={template}
              stampsCount={displayCount}
              stampsRequired={stampsRequired}
              rewardTitle={progress?.rewardTitle}
              establishmentName={establishment.name}
              status={success?.card.status ?? progress?.status}
              animateLast={!!success}
            />
          ) : (
            <Alert tone="error">Este local no está operativo por ahora.</Alert>
          )}
        </div>

        {!establishment.active && <Alert tone="error" className="mt-6 w-full">Local en mantenimiento. Volvé más tarde.</Alert>}

        {/* Zona de acción */}
        {isAuthed ? (
          <div className="mt-8 w-full space-y-4">
            {success ? (
              <div className="animate-fade-up space-y-4">
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                  <span className="animate-confetti absolute left-6 top-2 text-lg">🎉</span>
                  <span className="animate-confetti absolute right-10 top-4 text-sm" style={{ animationDelay: "0.2s" }}>🎊</span>
                  <span className="animate-confetti absolute left-16 top-8 text-sm" style={{ animationDelay: "0.4s" }}>✨</span>
                  <PartyPopper className="mx-auto h-8 w-8 text-emerald-600" />
                  {success.card.justCompleted ? (
                    <p className="mt-2 text-lg font-bold text-emerald-900">
                      ¡Tarjeta completa! Mostrale este código al local:
                    </p>
                  ) : (
                    <p className="mt-2 text-lg font-bold text-emerald-900">¡Sello sumado!</p>
                  )}
                  {success.card.justCompleted && success.card.redeemCode && (
                    <p className="mt-3 rounded-xl bg-white py-3 font-mono text-3xl font-bold tracking-[0.3em] text-ink-950 shadow-sm">
                      {success.card.redeemCode}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-emerald-800">
                    {success.card.justCompleted
                      ? `Canjeá "${success.card.rewardTitle}" en el mostrador`
                      : `Te faltan ${success.card.stampsRequired - success.card.stampsCount} sellos para "${success.card.rewardTitle}"`}
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setSuccess(null)}>
                  Entendido
                </Button>
              </div>
            ) : (
              <>
                {alreadyDone && (
                  <Alert tone="success">
                    Ya sumaste tu sello de hoy en este local. Volvé mañana para sumar otro. 🌟
                  </Alert>
                )}
                {claimError && <Alert tone="error">{claimError}</Alert>}
                <Button className="w-full" size="lg" onClick={claim} loading={claiming}>
                  <Stamp className="h-5 w-5" />
                  Sumar mi sello de hoy
                </Button>
                <div className="flex items-center gap-2 text-xs text-ink-600">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Un sello por día por cliente. Tu progreso queda guardado en tu cuenta.
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-8 w-full space-y-3">
            <Alert tone="info">
              Sumá sellos y ganá <strong>{template?.rewardTitle ?? "premios"}</strong> en {establishment.name}. Solo necesitás una cuenta gratis.
            </Alert>
            <div className="grid gap-3">
              <Link href={`/login?next=${encodeURIComponent(`/s/${token}?src=${src}`)}`} className="w-full">
                <Button className="w-full" size="lg">
                  Entrar y sumar mi sello
                </Button>
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(`/s/${token}?src=${src}`)}`}
                className="w-full rounded-xl border border-ink-300 bg-white py-3 text-center text-sm font-medium text-ink-900 transition-colors hover:bg-ink-100"
              >
                Crear mi cuenta gratis
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ClaimInner />
    </Suspense>
  );
}