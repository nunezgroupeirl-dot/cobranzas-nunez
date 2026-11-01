/**
 * Dónde se guardan las fotos.
 * - Con NEXT_PUBLIC_FOTOS_URL → Worker de Cloudflare con R2 (carpeta fotos/ del proyecto).
 * - Sin ella → Supabase Storage (buckets privados), como antes.
 * Los permisos son los mismos en los dos casos (ver fotos/index.js y supabase/esquema.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bucket } from "@/types/database";
import { ErrorDatos } from "./datos";

export interface Almacen {
  subir(bucket: Bucket, ruta: string, archivo: Blob): Promise<void>;
  borrar(bucket: Bucket, ruta: string): Promise<void>;
  url(bucket: Bucket, ruta: string): Promise<string | null>;
}

function almacenSupabase(sb: SupabaseClient): Almacen {
  return {
    async subir(bucket, ruta, archivo) {
      const { error } = await sb.storage.from(bucket).upload(ruta, archivo, { contentType: archivo.type || "image/jpeg", upsert: false });
      if (error) throw new ErrorDatos("FOTO", error.message);
    },
    async borrar(bucket, ruta) {
      const { error } = await sb.storage.from(bucket).remove([ruta]);
      if (error) throw new ErrorDatos("FOTO", error.message);
    },
    async url(bucket, ruta) {
      const { data } = await sb.storage.from(bucket).createSignedUrl(ruta, 3600);
      return data?.signedUrl ?? null;
    },
  };
}

/** Margen antes de que venza un enlace para pedir otro (los enlaces duran 1 hora). */
const MARGEN_S = 5 * 60;

function almacenWorker(sb: SupabaseClient, base: string): Almacen {
  const enlaces = new Map<string, { url: string; vence: number }>();

  const llamar = async (metodo: string, camino: string, cuerpo?: BodyInit, tipo?: string) => {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ErrorDatos("SESION", "Tu sesión expiró. Vuelve a ingresar.");
    const r = await fetch(`${base}${camino}`, {
      method: metodo,
      body: cuerpo,
      headers: { Authorization: `Bearer ${token}`, ...(tipo ? { "Content-Type": tipo } : {}) },
    }).catch(() => {
      throw new ErrorDatos("FOTO", "No se pudo conectar con el servidor de fotos. Revisa tu internet.");
    });
    if (!r.ok) {
      const detalle = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new ErrorDatos("FOTO", detalle?.error ?? `No se pudo procesar la foto (${r.status}).`);
    }
    return r;
  };
  const camino = (bucket: Bucket, ruta: string) => `/archivo/${bucket}/${ruta}`;

  return {
    async subir(bucket, ruta, archivo) {
      await llamar("PUT", camino(bucket, ruta), archivo, "image/jpeg");
    },
    async borrar(bucket, ruta) {
      enlaces.delete(`${bucket}/${ruta}`);
      await llamar("DELETE", camino(bucket, ruta));
    },
    async url(bucket, ruta) {
      const clave = `${bucket}/${ruta}`;
      const guardado = enlaces.get(clave);
      if (guardado && guardado.vence - MARGEN_S > Date.now() / 1000) return guardado.url;
      const r = await llamar("POST", "/firmar", JSON.stringify({ bucket, ruta }), "application/json");
      const { url, vence } = (await r.json()) as { url: string; vence: number };
      enlaces.set(clave, { url, vence });
      return url;
    },
  };
}

export function crearAlmacen(sb: SupabaseClient): Almacen {
  const base = process.env.NEXT_PUBLIC_FOTOS_URL?.trim().replace(/\/+$/, "");
  return base ? almacenWorker(sb, base) : almacenSupabase(sb);
}
