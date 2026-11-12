import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Tarjetas.app — Fidelidad digital para bares y cafés",
    template: "%s · Tarjetas.app",
  },
  description:
    "SaaS de tarjetas de sellos digitales: QR/NFC, premios y analytics para bares, cafés, heladerías y restaurantes.",
  manifest: "/manifest.webmanifest",
  applicationName: "Tarjetas.app",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tarjetas.app" },
};

export const viewport: Viewport = {
  themeColor: "#F06407",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}