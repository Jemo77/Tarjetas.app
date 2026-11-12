"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { LoyaltyCard } from "@/components/loyalty-card";
import { Alert, Badge, Button, Card, EmptyState, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { WalletGroup } from "@/lib/types";
import { Gift, Smartphone } from "lucide-react";

function RedeemModal({ group, onClose }: { group: WalletGroup; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const card = group.activeCard;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<{ token: string; redeemCode: string; url: string }>(`/me/cards/${card.id}/redeem-qr`)
      .then(async (res) => {
        if (!active) return;
        setCode(res.redeemCode);
        const dataUrl = await QRCode.toDataURL(res.url, { width: 280, margin: 1 });
        if (active) setUrl(dataUrl);
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [card.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()} padded>
        <h2 className="text-center text-lg font-bold text-ink-950">Canjeá tu premio</h2>
        <p className="mt-1 text-center text-sm text-ink-600">
          Mostrale esto al personal de <strong>{group.establishment.name}</strong>
        </p>

        {loading && <div className="my-8 text-center text-sm text-ink-600">Generando QR…</div>}
        {error && <Alert tone="error" className="mt-4">{error}</Alert>}
        {url && (
          <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-ink-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="QR de canje" className="mx-auto h-64 w-64" />
          </div>
        )}
        {code && (
          <>
            <div className="mt-4 text-center">
              <p className="text-xs uppercase tracking-wide text-ink-600">o con este código</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-ink-950">{code}</p>
            </div>
            <Alert tone="info" className="mt-4">
              <Smartphone className="mr-1 inline h-4 w-4" /> El QR vence a los 2 minutos. Actualizalo si expira.
            </Alert>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => !loading && onClose()}>
            Cerrar
          </Button>
          <Button variant="secondary" className="flex-1" loading={loading} onClick={() => onClose()} disabled={loading}>
            Listo, ya lo canjeé
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function CardsPage() {
  const { status } = useAuth();
  const [redeem, setRedeem] = useState<WalletGroup | null>(null);

  const query = useQuery({
    queryKey: ["my-wallet"],
    queryFn: () => api.get<{ establishments: WalletGroup[] }>("/me/cards"),
    enabled: status === "authed",
  });

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (status === "guest") {
    return (
      <EmptyState
        title="Ingresá para ver tus tarjetas"
        description="Tus sellos se guardan en tu cuenta. Entrá para seguir acumulando."
        action={
          <a href="/login">
            <Button>Ingresar</Button>
          </a>
        }
      />
    );
  }
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;

  const groups = query.data?.establishments ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Mis tarjetas</h1>
        <p className="mt-1 text-sm text-ink-600">Sumá un sello por día en cada local y ganá premios.</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="Todavía no tenés tarjetas"
          description="Escaneá el QR de un local participante o pedile al personal que te sume tu primer sello."
        />
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          {groups.map((group) => {
            const card = group.activeCard;
            return (
              <div key={group.establishment.id} className="flex flex-col items-center gap-4">
                <LoyaltyCard
                  template={group.template}
                  stampsCount={card.stampsCount}
                  stampsRequired={card.stampsRequired}
                  rewardTitle={card.rewardTitle}
                  establishmentName={group.establishment.name}
                  status={card.status}
                />
                <div className="flex w-full max-w-[340px] items-center justify-between gap-2">
                  {card.status === "COMPLETED" ? (
                    <Button className="flex-1" onClick={() => setRedeem(group)}>
                      <Gift className="h-4 w-4" /> Canjear premio
                    </Button>
                  ) : card.status === "REDEEMED" ? (
                    <Badge tone="blue" className="w-full justify-center py-1.5">Premio canjeado 🎉</Badge>
                  ) : card.status === "EXPIRED" ? (
                    <Badge tone="red" className="w-full justify-center py-1.5">Premio vencido</Badge>
                  ) : (
                    <div className="flex w-full items-center justify-between rounded-xl bg-ink-100 px-4 py-2.5 text-sm text-ink-800">
                      <span>
                        Te faltan <strong>{card.stampsRequired - card.stampsCount}</strong> sellos
                      </span>
                      <span className="font-semibold text-brand-700">{card.stampsCount}/{card.stampsRequired}</span>
                    </div>
                  )}
                </div>
                {group.cards.length > 1 && (
                  <p className="text-xs text-ink-600">
                    Ciclo {card.cycle} · {group.cards.length} tarjeta{group.cards.length > 1 ? "s" : ""} en total
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {redeem && <RedeemModal group={redeem} onClose={() => setRedeem(null)} />}
    </div>
  );
}