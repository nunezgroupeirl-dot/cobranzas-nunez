/**
 * Ubicación del cliente: se guarda un enlace de Google Maps o coordenadas "lat,lng"
 * (las que da el GPS del celular). No hace falta llave de Google: se usan enlaces públicos.
 */

export interface Coordenadas {
  lat: number;
  lng: number;
}

const valida = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Coordenadas escritas a mano ("-12.05, -77.04") o dentro de un enlace de Google Maps (@-12.05,-77.04 · q=-12.05,-77.04 · !3d-12.05!4d-77.04). */
export function coordenadas(ubicacion: string | null | undefined): Coordenadas | null {
  const t = (ubicacion ?? "").trim();
  if (!t) return null;
  const patrones = [/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/, /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i, /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/];
  for (const p of patrones) {
    const m = t.match(p);
    if (m && valida(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

export const esEnlace = (t: string | null | undefined) => /^https:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test((t ?? "").trim());

/** ¿Lo escrito sirve como ubicación? (vacío también vale: es opcional) */
export const ubicacionValida = (t: string) => !t.trim() || !!coordenadas(t) || esEnlace(t);

const busqueda = (direccion: string) => encodeURIComponent(direccion.includes("Lima") || direccion.includes("Callao") ? direccion : `${direccion}, Lima, Perú`);

/** Enlace para abrir en Google Maps (en el celular abre la app). */
export function enlaceMapa(ubicacion: string | null | undefined, direccion?: string | null): string | null {
  const c = coordenadas(ubicacion);
  if (c) return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
  if (esEnlace(ubicacion)) return (ubicacion ?? "").trim();
  if (direccion?.trim()) return `https://www.google.com/maps/search/?api=1&query=${busqueda(direccion)}`;
  return null;
}

/** "Cómo llegar" desde donde está el cobrador. */
export function enlaceRuta(ubicacion: string | null | undefined, direccion?: string | null): string | null {
  const c = coordenadas(ubicacion);
  if (c) return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
  if (direccion?.trim()) return `https://www.google.com/maps/dir/?api=1&destination=${busqueda(direccion)}`;
  return enlaceMapa(ubicacion, direccion);
}

/** Mapa para mostrar dentro de la ficha (sin llave). Con un enlace corto sin coordenadas se usa la dirección. */
export function mapaIncrustado(ubicacion: string | null | undefined, direccion?: string | null): string | null {
  const c = coordenadas(ubicacion);
  if (c) return `https://maps.google.com/maps?q=${c.lat},${c.lng}&z=17&output=embed`;
  if (direccion?.trim()) return `https://maps.google.com/maps?q=${busqueda(direccion)}&z=16&output=embed`;
  return null;
}

/** Posición actual del celular (pide permiso). */
export function miUbicacion(): Promise<Coordenadas> {
  return new Promise((resolver, rechazar) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return rechazar(new Error("Este dispositivo no da su ubicación. Pega el enlace de Google Maps."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      (e) =>
        rechazar(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "No diste permiso de ubicación. Actívalo en el navegador o pega el enlace de Google Maps."
              : "No se pudo obtener la ubicación. Sal a un lugar abierto e inténtalo otra vez.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
