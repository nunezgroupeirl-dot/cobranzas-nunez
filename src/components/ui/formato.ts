import type { Color, EstadoCuota, MedioPago, TipoDocumento } from "@/types/database";

const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });

export const formatoSoles = (n: number | null | undefined) => soles.format(n ?? 0);

/** "2026-10-15" → "15/10/2026" (sin pasar por zona horaria) */
export function formatoFecha(f: string | null | undefined): string {
  if (!f) return "—";
  const [a, m, d] = f.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" });
}

export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  yape: "Yape",
  plin: "Plin",
  banco: "Banco",
  agente: "Agente",
  efectivo: "Efectivo",
};

export const NOMBRE_ESTADO_CUOTA: Record<EstadoCuota, string> = {
  pagada_a_tiempo: "Pagada a tiempo",
  pagada_con_atraso: "Pagada con atraso",
  vencida: "Vencida",
  pendiente: "Pendiente",
};

export const NOMBRE_ESTADO_CONTRATO: Record<"activo" | "terminado" | "anulado", string> = {
  activo: "Activo",
  terminado: "Terminado",
  anulado: "Cerrado",
};

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  cliente: "Foto del cliente",
  dni: "DNI",
  moto: "Moto",
  fachada: "Fachada",
  recibo: "Recibo de luz/agua",
  otro: "Otro",
};

/** Mensajes en palabras simples para los errores de la base de datos */
export const MENSAJE_ERROR: Record<string, string> = {
  OPERACION_REPETIDA: "Este número de operación ya se registró.",
  IMAGEN_REPETIDA: "Esta foto ya se usó en otro pago.",
  MONTO_INVALIDO: "El monto no es válido o es mayor a lo que debe el cliente.",
  SIN_FOTO: "Falta la foto del comprobante.",
  SIN_PERMISO: "No tienes permiso para hacer esto.",
  SIN_SESION: "Tu sesión terminó. Vuelve a ingresar.",
};

export function mensajeDeError(e: unknown): string {
  if (e && typeof e === "object" && "codigo" in e) {
    const codigo = String((e as { codigo: unknown }).codigo);
    if (MENSAJE_ERROR[codigo]) return MENSAJE_ERROR[codigo];
  }
  if (e instanceof Error && e.message) return e.message;
  return "Algo salió mal. Inténtalo otra vez.";
}

/** Fecha de hoy en Lima (YYYY-MM-DD). Lo registrado después de las 10:00 p.m. cuenta para el día siguiente. */
export function hoyLima(ahora: Date = new Date()): string {
  const lima = new Date(ahora.getTime() - 5 * 3_600_000);
  const minutos = lima.getUTCHours() * 60 + lima.getUTCMinutes();
  const base = minutos > 22 * 60 ? new Date(lima.getTime() + 86_400_000) : lima;
  return base.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(new Date(`${fecha}T00:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Colores del semáforo para bordes y acentos (los mismos de globals.css) */
export const COLOR_HEX: Record<Color, string> = { verde: "#1f8a4c", amarillo: "#b57900", rojo: "#c0362c" };

export function textoSemaforo(color: Color, semanas: number) {
  if (color === "verde" || semanas <= 0) return "Al día";
  return `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
}
