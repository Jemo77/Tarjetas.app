"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React from "react";

/* Botones ----------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600 focus-visible:ring-brand-500",
  secondary: "bg-ink-900 text-white hover:bg-ink-800 disabled:hover:bg-ink-900",
  outline:
    "border border-ink-300 bg-white text-ink-900 hover:bg-ink-100 disabled:hover:bg-white",
  ghost: "text-ink-700 hover:bg-ink-200 hover:text-ink-900",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* Campos ------------------------------------------------------------------ */

export const inputClass =
  "w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function Input({
  className,
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <input className={cn(inputClass, error && "border-red-400 focus:border-red-500 focus:ring-red-500/20", className)} {...props} />
      {hint && !error && <span className="mt-1 block text-xs text-ink-600">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Textarea({
  className,
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <textarea className={cn(inputClass, "min-h-20 resize-y", className)} {...props} />
    </label>
  );
}

export function Select({
  className,
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <select className={cn(inputClass, "appearance-none bg-white", className)} {...props}>
        {children}
      </select>
    </label>
  );
}

/* Estructura --------------------------------------------------------------- */

export function Card({
  className,
  children,
  padded = true,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  padded?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      className={cn("rounded-2xl border border-ink-200 bg-white shadow-sm", padded && "p-5", className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && "border-brand-200 bg-brand-50")}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-600">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-ink-950">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-600">{sub}</p>}
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "brand";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-200 text-ink-800",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-sky-100 text-sky-800",
    brand: "bg-brand-100 text-brand-800",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand-600", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center">
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-600">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* Modal -------------------------------------------------------------------- */

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <Card className={cn("w-full", wide ? "max-w-2xl" : "max-w-md")} onClick={(e) => e.stopPropagation()} padded>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-950">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}

/* Alerta ------------------------------------------------------------------- */

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)} role="alert">
      {children}
    </div>
  );
}

/* Logo --------------------------------------------------------------------- */

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", light ? "text-white" : "text-ink-950", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5L2.6 8.8l6.5-.9z" />
        </svg>
      </span>
      <span>
        Tarjetas<span className="text-brand-600">.app</span>
      </span>
    </span>
  );
}