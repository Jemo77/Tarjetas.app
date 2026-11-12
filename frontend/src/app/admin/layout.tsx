"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/ui";
import {
  LayoutDashboard,
  Store,
  CreditCard,
  ScrollText,
  Hammer,
  LogOut,
  ArrowLeft,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/establishments", label: "Locales", icon: Store },
  { href: "/admin/plans", label: "Planes", icon: CreditCard },
  { href: "/admin/audit", label: "Auditoría", icon: ScrollText },
  { href: "/admin/jobs", label: "Tareas", icon: Hammer },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-ink-950 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col border-b border-ink-800 bg-ink-950 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-2 border-b border-ink-800 px-5">
          <Link href="/">
            <Logo light />
          </Link>
        </div>

        <div className="border-b border-ink-800 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Panel de plataforma</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">
            {status === "authed" ? user?.name ?? user?.email : "—"}
          </p>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-visible">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-ink-300 hover:bg-ink-900 hover:text-white",
                )}
              >
                <Icon className="h-4.5 w-4.5" /> {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-ink-800 p-3">
          <Link
            href="/panel"
            className="inline-flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:bg-ink-900 hover:text-white"
          >
            <ArrowLeft className="h-4.5 w-4.5" /> Ir al panel
          </Link>
          <button
            onClick={onLogout}
            className="inline-flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:bg-ink-900 hover:text-white"
          >
            <LogOut className="h-4.5 w-4.5" /> Salir
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="bg-ink-100/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}