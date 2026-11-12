"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Alert, Badge, Button, Card, Input, PageLoader, Select } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { QrCode as QrIcon, Download, RefreshCcw, Nfc, Smartphone } from "lucide-react";

interface StampPoint {
  point: {
    id: string;
    label: string;
    token: string;
    validationMode: "STATIC" | "ROTATING";
    rotatedAt: string | null;
    url: string;
    nfcUrl: string;
    currentWindow?: { url: string; token: string; windowIndex: number; validForSeconds: number };
  };
}

interface RotatingToken {
  rotating: boolean;
  establishment?: { name: string; logoUrl: string | null };
  url?: string;
  token?: string;
  windowIndex?: number;
  validForSeconds?: number;
}

export default function QrPage() {
  const { status, user } = useAuth();
  const role = user?.memberships?.[0]?.role;

  const pointQuery = useQuery({
    queryKey: ["stamp-point"],
    queryFn: () => api.get<StampPoint>("/business/stamp-point"),
    enabled: status === "authed",
    retry: false,
  });
  const rotatingQuery = useQuery({
    queryKey: ["rotating-token"],
    queryFn: () => api.get<RotatingToken>("/business/rotating-token"),
    enabled: status === "authed",
    refetchInterval: 30_000,
  });

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"STATIC" | "ROTATING">("STATIC");
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const point = pointQuery.data?.point;
  const rotatingData = rotatingQuery.data;

  // Genero el QR para el modo actual
  useEffect(() => {
    if (point?.validationMode === "ROTATING" && rotatingData?.rotating && rotatingData.url) {
      QRCode.toDataURL(rotatingData.url, { width: 300, margin: 1 }).then(setQrUrl).catch(() => setQrUrl(null));
    } else if (point) {
      QRCode.toDataURL(point.url, { width: 300, margin: 1 }).then(setQrUrl).catch(() => setQrUrl(null));
    }
  }, [point, rotatingData]);

  useEffect(() => {
    if (point) {
      setLabel(point.label);
      setMode(point.validationMode);
    }
  }, [point]);

  if (status === "loading" || (status === "authed" && pointQuery.isLoading)) return <PageLoader />;
  if (pointQuery.isError || !point) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-ink-950">QR / NFC</h1>
        <Alert tone="error">{errorMessage(pointQuery.error)}</Alert>
      </div>
    );
  }
  if (rotatingQuery.isError) return <Alert tone="error">{errorMessage(rotatingQuery.error)}</Alert>;

  const isRotating = point.validationMode === "ROTATING";
  const canRotate = role === "OWNER";

  async function saveConfig() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.patch<StampPoint>("/business/stamp-point", { label: label.trim() || undefined, validationMode: mode });
      setInfo("Configuración actualizada.");
      pointQuery.refetch();
      rotatingQuery.refetch();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function rotateNow() {
    setRotating(true);
    setError(null);
    setInfo(null);
    try {
      await api.post<StampPoint>("/business/stamp-point/rotate");
      setInfo("QR rotado: el anterior quedó desactivado.");
      pointQuery.refetch();
      rotatingQuery.refetch();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">QR / NFC del local</h1>
        <p className="mt-1 text-sm text-ink-600">El código que escanean tus clientes para sumar su sello del día.</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Config */}
        <div className="space-y-5">
          <Card>
            <h2 className="text-sm font-semibold text-ink-900">Configuración</h2>
            <div className="mt-4 space-y-4">
              <Input label="Nombre del punto" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Select label="Modo de validación" value={mode} onChange={(e) => setMode(e.target.value as "STATIC" | "ROTATING")}>
                <option value="STATIC">Estático (imprimir y pegar)</option>
                <option value="ROTATING">Dinámico (cambia cada 60 s)</option>
              </Select>
              {mode === "ROTATING" && (
                <Alert tone="info">
                  <Smartphone className="mr-1 inline h-4 w-4" />
                  El QR se muestra en pantalla y se renueva cada minuto. Ideal para mostrador o mozos.
                </Alert>
              )}
              <Button onClick={saveConfig} loading={saving}>
                Guardar configuración
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-ink-900">Link del QR / NFC</h2>
            <div className="mt-3 space-y-2 font-mono text-xs text-ink-700">
              <p className="truncate rounded-lg bg-ink-50 px-3 py-2">{isRotating ? rotatingData?.url ?? point.url : point.url}</p>
              <p className="truncate rounded-lg bg-ink-50 px-3 py-2">{point.nfcUrl}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1"}/business/stamp-point/qr.svg`} download="qr.svg">
                <Button variant="outline" size="sm"><Download className="h-4 w-4" /> SVG (imprimir)</Button>
              </a>
              <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1"}/business/stamp-point/qr.png`} download="qr.png">
                <Button variant="outline" size="sm"><Download className="h-4 w-4" /> PNG</Button>
              </a>
              {canRotate && !isRotating && (
                <Button variant="danger" size="sm" onClick={rotateNow} loading={rotating}>
                  <RefreshCcw className="h-4 w-4" /> Rotar token
                </Button>
              )}
            </div>
            {!canRotate && (
              <p className="mt-3 text-xs text-ink-600">Solo el dueño puede rotar el token.</p>
            )}
          </Card>
        </div>

        {/* QR */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="QR del local" className="mx-auto h-64 w-64" />
            ) : (
              <div className="mx-auto grid h-64 w-64 place-items-center text-ink-400">
                <QrIcon className="h-12 w-12" />
              </div>
            )}
            <p className="mt-4 text-sm font-semibold text-ink-900">{point.label}</p>
            <p className="mt-1 text-xs text-ink-600">
              {isRotating
                ? `Modo dinámico · cambia cada ${rotatingData?.validForSeconds ?? 60} s`
                : "Modo estático · no caduca"}
            </p>
            {isRotating && rotatingData?.windowIndex != null && (
              <span className="mt-2 inline-block"><Badge tone="brand">Ventana #{rotatingData.windowIndex}</Badge></span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white px-4 py-3 text-sm text-ink-700">
            <Nfc className="h-4 w-4 text-brand-600" />
            El mismo link funciona con NFC (tag o pulsera).
          </div>
        </div>
      </div>
    </div>
  );
}