import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "@fontsource/barlow-semi-condensed/latin-700.css";
import "./globals.css";

const SITIO = "https://cobranzasntaa.pages.dev";
const NOMBRE = "Inversiones Núñez & Asociados";
const DESCRIPCION = "Sistema de cobranzas: clientes, contratos de alquiler venta y pagos de motos y mototaxis.";

// Lo que se ve al compartir el enlace (WhatsApp, Facebook, Telegram): logo, nombre y descripción
export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: `${NOMBRE} · Cobranzas`,
  description: DESCRIPCION,
  applicationName: NOMBRE,
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITIO,
    siteName: NOMBRE,
    title: NOMBRE,
    description: DESCRIPCION,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: `Logo de ${NOMBRE}` }],
  },
  twitter: { card: "summary_large_image", title: NOMBRE, description: DESCRIPCION, images: ["/og.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141414",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
