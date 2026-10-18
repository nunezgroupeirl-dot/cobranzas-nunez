import type { NextConfig } from "next";

/**
 * Sitio estático (carpeta `out/`) para Cloudflare Pages.
 * Todo el acceso a datos ocurre en el navegador contra Supabase, y la seguridad
 * la aplica la base de datos (RLS), así que no hace falta un servidor propio.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
