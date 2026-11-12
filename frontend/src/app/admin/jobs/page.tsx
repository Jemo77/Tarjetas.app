"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, PageLoader } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Hammer, Play } from "lucide-react";

interface JobDef {
  name: string;
  label: string;
  description: string;
  cadence: string;
}

const JOBS: JobDef[] = [
  {
    name: "recompute-segments",
    label: "Recalcular segmentos",
    description: "Actualiza el segmento (nuevo, activo, leal, en riesgo, perdido) de cada cliente según su frecuencia de visitas.",
    cadence: "Diario · 03:00",
  },
  {
    name: "expire-rewards",
    label: "Vencer premios",
    description: "Marca como EXPIRED los premios completados cuyo plazo de canje ya venció.",
    cadence: "Diario",
  },
  {
    name: "cleanup-auth",
    label: "Limpiar auth",
    description: "Borra desafíos OTP expirados y refresh tokens revocados de más de 30 días.",
    cadence: "Diario",
  },
  {
    name: "winback-emails",
    label: "Emails de recuperación",
    description: "Envía recordatorios a clientes en riesgo (AT_RISK) para que vuelvan al local.",
    cadence: "Semanal",
  },
  {
    name: "subscription-check",
    label: "Chequear suscripciones",
    description: "Sincroniza suscripciones vencidas, aplica el período de gracia y suspende locales.",
    cadence: "Diario",
  },
];

export default function AdminJobsPage() {
  const { status } = useAuth();
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") return <PageLoader />;

  async function runJob(job: JobDef) {
    setRunning(job.name);
    setError(null);
    try {
      const res = await api.post<{ job: string; ranAt: string; result?: unknown }>(`/admin/jobs/${job.name}/run`);
      setResults((r) => ({
        ...r,
        [job.name]: `Ejecutado a las ${new Date(res.ranAt).toLocaleTimeString("es-AR")}${
          res.result ? ` · ${JSON.stringify(res.result)}` : ""
        }`,
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-950">Tareas programadas</h1>
        <p className="mt-1 text-sm text-ink-600">
          Ejecutá a demanda los jobs del sistema. En producción corren solos con su frecuencia.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        {JOBS.map((job) => (
          <Card key={job.name} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                  <Hammer className="h-4 w-4 text-brand-600" /> {job.label}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">{job.description}</p>
              </div>
              <Badge tone="neutral">{job.cadence}</Badge>
            </div>
            {results[job.name] && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{results[job.name]}</p>
            )}
            <div className="mt-4 flex justify-end border-t border-ink-100 pt-3">
              <Button size="sm" variant="outline" onClick={() => runJob(job)} loading={running === job.name} disabled={running !== null}>
                <Play className="h-3.5 w-3.5" /> Ejecutar ahora
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}