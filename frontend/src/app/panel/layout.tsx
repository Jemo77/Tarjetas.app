"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/ui";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  PenTool,
  QrCode,
  Gift,
  UserCog,
  Settings,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/panel/customers", label: "Clientes", icon: Users },
  { href: "/panel/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/panel/card-designer", label: "Diseñador", icon: PenTool },
  { href: "/panel/qr", label: "QR / NFC", icon: QrCode },
  { href: "/panel/redeem", label: "Canje", icon: Gift },
  { href: "/panel/team", label: "Equipo", icon: UserCog },
  { href: "/panel/settings", label: "Ajustes", icon: Settings },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const membership = user?.memberships?.[0];

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-ink-50 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="flex flex-col border-b border-ink-200 bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-2 border-b border-ink-200 px-5">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <div className="border-b border-ink-200 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-600">Local activo</p>
          <p className="mt-1 truncate text-sm font-semibold text-ink-950">
            {status === "authed" && membership ? membership.establishmentName : "—"}
          </p>
          {status === "authed" && membership && (
            <p className="text-xs text-ink-600">{roleLabel(membership.role)}</p>
          )}
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
                    ? "bg-brand-100 text-brand-800"
                    : "text-ink-700 hover:bg-ink-100 hover:text-ink-950",
                )}
              >
                <Icon className="h-4.5 w-4.5" /> {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-200 p-3">
          <button
            onClick={onLogout}
            className="inline-flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950"
          >
            <LogOut className="h-4.5 w-4.5" /> Salir
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">{children}</main>
    </div>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    OWNER: "Dueño/a",
    MANAGER: "Encargado/a",
    STAFF: "Personal",
  };
  return labels[role] ?? role;
}