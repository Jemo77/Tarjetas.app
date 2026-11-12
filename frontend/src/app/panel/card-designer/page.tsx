"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Input, PageLoader, Select, Textarea } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LoyaltyCard } from "@/components/loyalty-card";
import type { CardTemplate } from "@/lib/types";

interface TemplateResponse {
  template: CardTemplate & {
    id: string;
    name: string;
    version: number;
    rewardValidDays: number | null;
  };
}

interface DesignForm {
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string;
  rewardValidDays: number | "";
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  stampIconKey: string;
  emptySlotStyle: string;
}

const STAMP_ICONS = [
  { key: "coffee", label: "☕ Café" },
  { key: "beer", label: "🍺 Cerveza" },
  { key: "star", label: "⭐ Estrella" },
  { key: "cocktail", label: "🍸 Trago" },
  { key: "heart", label: "❤️ Corazón" },
  { key: "pizza", label: "🍕 Pizza" },
  { key: "burger", label: "🍔 Burger" },
  { key: "sun", label: "☀️ Sol" },
];

const SLOT_STYLES = [
  { value: "outline", label: "Contorno" },
  { value: "dotted", label: "Punteado" },
  { value: "filled", label: "Relleno" },
];

export default function CardDesignerPage() {
  const { status } = useAuth();

  const query = useQuery({
    queryKey: ["card-template"],
    queryFn: () => api.get<TemplateResponse>("/business/card-template"),
    enabled: status === "authed",
  });

  const [form, setForm] = useState<DesignForm | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Sincronizo el formulario cuando llega la plantilla
  useEffect(() => {
    if (query.data && !form) {
      const t = query.data.template;
      setForm({
        stampsRequired: t.stampsRequired,
        rewardTitle: t.rewardTitle,
        rewardDescription: t.rewardDescription ?? "",
        rewardValidDays: t.rewardValidDays ?? "",
        backgroundColor: t.backgroundColor,
        textColor: t.textColor,
        accentColor: t.accentColor,
        stampIconKey: t.stampIconKey ?? "star",
        emptySlotStyle: t.emptySlotStyle,
      });
    }
  }, [query.data, form]);

  if (status === "loading" || (status === "authed" && query.isLoading)) return <PageLoader />;
  if (query.isError) return <Alert tone="error">{errorMessage(query.error)}</Alert>;

  function set<K extends keyof DesignForm>(key: K, value: DesignForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  if (!form) return null;

  const previewTemplate: CardTemplate = {
    stampsRequired: form.stampsRequired,
    rewardTitle: form.rewardTitle,
    rewardDescription: form.rewardDescription || null,
    backgroundColor: form.backgroundColor,
    backgroundImageUrl: null,
    textColor: form.textColor,
    accentColor: form.accentColor,
    logoUrl: null,
    stampIconKey: form.stampIconKey,
    stampIconUrl: null,
    emptySlotStyle: form.emptySlotStyle as "outline" | "dotted" | "filled",
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put("/business/card-template", {
        stampsRequired: form.stampsRequired,
        rewardTitle: form.rewardTitle,
        rewardDescription: form.rewardDescription || null,
        rewardValidDays: form.rewardValidDays === "" ? null : Number(form.rewardValidDays),
        backgroundColor: form.backgroundColor,
        textColor: form.textColor,
        accentColor: form.accentColor,
        stampIconKey: form.stampIconKey || null,
        emptySlotStyle: form.emptySlotStyle,
      });
      setMessage({ tone: "success", text: "Diseño guardado. La próxima tarjeta usará este nuevo diseño." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">Diseñador de tarjeta</h1>
          <p className="mt-1 text-sm text-ink-600">
            Cambiá el diseño y las reglas. Las tarjetas nuevas lo usan al primer sello.
          </p>
        </div>
        {query.data && <Badge tone="neutral">Versión {query.data.template.version}</Badge>}
      </div>

      {message && (
        <Alert tone={message.tone} className="mb-4">{message.text}</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Formulario */}
        <div className="space-y-5">
          <Card>
            <h2 className="text-sm font-semibold text-ink-900">Reglas</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Sellos para el premio"
                type="number"
                min={3}
                max={50}
                value={form.stampsRequired}
                onChange={(e) => set("stampsRequired", Number(e.target.value))}
              />
              <Input
                label="Días para canjear (vacío = sin vencimiento)"
                type="number"
                min={1}
                max={365}
                placeholder="Sin vencimiento"
                value={form.rewardValidDays}
                onChange={(e) => set("rewardValidDays", e.target.value === "" ? "" : Number(e.target.value))}
              />
              <div className="sm:col-span-2">
                <Input label="¿Qué se gana?" value={form.rewardTitle} onChange={(e) => set("rewardTitle", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Descripción (opcional)"
                  value={form.rewardDescription}
                  onChange={(e) => set("rewardDescription", e.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-ink-900">Diseño</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <ColorField label="Fondo" value={form.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
              <ColorField label="Texto" value={form.textColor} onChange={(v) => set("textColor", v)} />
              <ColorField label="Acento" value={form.accentColor} onChange={(v) => set("accentColor", v)} />
              <Select label="Sello" value={form.stampIconKey} onChange={(e) => set("stampIconKey", e.target.value)}>
                {STAMP_ICONS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </Select>
              <Select label="Celdas vacías" value={form.emptySlotStyle} onChange={(e) => set("emptySlotStyle", e.target.value)}>
                {SLOT_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} loading={saving} size="lg">
              Guardar diseño
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="mb-3 text-sm font-medium text-ink-800">Vista previa</p>
          <LoyaltyCard
            template={previewTemplate}
            stampsCount={Math.min(form.stampsRequired, 3)}
            stampsRequired={form.stampsRequired}
            rewardTitle={form.rewardTitle}
            establishmentName="Tu local"
            status="ACTIVE"
          />
          <p className="mt-3 text-center text-xs text-ink-600">
            Este es el diseño que verán tus clientes al escanear.
          </p>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border border-ink-300 bg-white p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-ink-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
    </label>
  );
}