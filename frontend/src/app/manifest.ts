import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tarjetas.app — Fidelidad digital",
    short_name: "Tarjetas",
    description: "Tarjetas de sellos digitales para bares y cafés. Sumá un sello por día y ganá premios.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5F2",
    theme_color: "#F06407",
    orientation: "portrait",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}