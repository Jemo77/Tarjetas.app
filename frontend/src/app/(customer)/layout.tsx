"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/ui";
import { CreditCard, LogOut, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/cards"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/cards") ? "bg-brand-100 text-brand-800" : "text-ink-700 hover:bg-ink-200",
              )}
            >
              <CreditCard className="h-4 w-4" /> Mis tarjetas
            </Link>
            <Link
              href="/profile"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/profile") ? "bg-brand-100 text-brand-800" : "text-ink-700 hover:bg-ink-200",
              )}
            >
              <User className="h-4 w-4" /> Perfil
            </Link>
            {status === "authed" && (
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-200"
              >
                <LogOut className="h-4 w-4" /> Salir
              </button>
            )}
          </nav>
        </div>
        {status === "authed" && user && (
          <div className="mx-auto max-w-5xl px-4 pb-3 text-xs text-ink-600">
            Hola, {user.name ?? user.email} · {user.email}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="py-6 text-center text-xs text-ink-600">Tarjetas.app – fidelidad que funciona</footer>
    </div>
  );
}