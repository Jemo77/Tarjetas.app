import Link from "next/link";
import { Logo } from "@/components/ui";
import { CheckCircle2, QrCode, Gift, BarChart3, Users, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: QrCode,
    title: "QR y NFC",
    text: "Cada cliente escanea y suma su sello del día en segundos. Modo QR rotativo contra copias.",
  },
  {
    icon: Gift,
    title: "Premios automáticos",
    text: "Al completar la tarjeta se genera un código de canje. El personal lo valida al toque de un botón.",
  },
  {
    icon: BarChart3,
    title: "Analytics en vivo",
    text: "Clientes nuevos, retención, días con más visitas y rendimiento de tu equipo.",
  },
  {
    icon: Users,
    title: "Equipo y roles",
    text: "Dueños, managers y mozos con permisos distintos. Todo auditado en un panel claro.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-fraude",
    text: "Un sello por cliente por día, geofence opcional y trazabilidad de cada movimiento.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-200"
          >
            Ingresar
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Empezar gratis
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-14 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-800">
            Fidelidad digital para bares y cafés
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-ink-950 sm:text-6xl">
            La tarjeta de sellos que tus clientes{" "}
            <span className="text-brand-600">llevan en el bolsillo</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-600">
            Sin papel ni tarjetas físicas. Un sello por día por cliente, premios automáticos y datos claros
            para que vuelvan siempre.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700"
            >
              Crear mi local
            </Link>
            <Link
              href="#como-funciona"
              className="rounded-xl border border-ink-300 bg-white px-7 py-3.5 text-base font-medium text-ink-900 transition-colors hover:bg-ink-100"
            >
              Cómo funciona
            </Link>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto w-full max-w-6xl px-6 pb-20">
          <h2 className="text-center text-2xl font-bold text-ink-950 sm:text-3xl">Así de simple</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              { n: "1", t: "Pegás el QR en el local", d: "Lo imprimís o lo mostrás en la pantalla. Cada mozo puede tener uno propio." },
              { n: "2", t: "El cliente escanea", d: "Suma su sello del día automáticamente. A las 10 visitas, premio listo." },
              { n: "3", t: "Canjeás en un toque", d: "El personal lee el código o el QR del cliente y confirma el premio." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-800">
                  {s.n}
                </span>
                <h3 className="mt-4 font-semibold text-ink-950">{s.t}</h3>
                <p className="mt-1.5 text-sm text-ink-600">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="bg-white py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h2 className="text-center text-2xl font-bold text-ink-950 sm:text-3xl">Todo lo que necesita tu negocio</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-ink-200 bg-ink-50 p-6">
                  <f.icon className="h-7 w-7 text-brand-600" />
                  <h3 className="mt-4 font-semibold text-ink-950">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-600">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-4xl px-6 py-20 text-center">
          <div className="rounded-3xl bg-ink-950 p-10 text-white">
            <h2 className="text-2xl font-bold sm:text-3xl">Empezá hoy. Configuralo en 5 minutos.</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-400">
              Plan gratuito para hasta 50 clientes. Sin tarjeta de crédito para empezar.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-brand-500"
            >
              <CheckCircle2 className="h-5 w-5" />
              Crear mi cuenta gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200 py-8 text-center text-sm text-ink-600">
        <Logo />
        <p className="mt-2">© 2026 Tarjetas.app — Fidelidad digital para bares y cafés</p>
      </footer>
    </div>
  );
}