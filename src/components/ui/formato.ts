import type { Color, EstadoCuota, Frecuencia, MedioPago, TipoDoc, TipoDocumento } from "@/types/database";

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
  cliente_contrato: "Cliente con el contrato",
  dni: "DNI o Carné de Extranjería (frente)",
  dni_reverso: "DNI o Carné de Extranjería (reverso)",
  moto: "Vehículo (frente)",
  moto_atras: "Vehículo (atrás)",
  moto_izquierda: "Vehículo (lado izquierdo)",
  moto_derecha: "Vehículo (lado derecho)",
  fachada: "Fachada",
  recibo: "Recibo de luz/agua",
  otro: "Otro",
  contrato: "Contrato firmado",
};

/** Cada documento: su nombre, cómo se abrevia, qué número acepta y cómo se explica (la misma regla está en la base). */
export const DOCUMENTOS: Record<TipoDoc, { texto: string; corto: string; regla: RegExp; ayuda: string; letras: boolean; largo: number }> = {
  DNI: { texto: "DNI", corto: "DNI", regla: /^\d{8}$/, ayuda: "El DNI tiene 8 números.", letras: false, largo: 8 },
  CE: { texto: "Carné de Extranjería", corto: "C.E.", regla: /^\d{8,12}$/, ayuda: "El Carné de Extranjería tiene de 8 a 12 números.", letras: false, largo: 12 },
  CEDULA: { texto: "Cédula", corto: "Cédula", regla: /^\d{5,12}$/, ayuda: "La cédula tiene de 5 a 12 números.", letras: false, largo: 12 },
  PASAPORTE: { texto: "Pasaporte", corto: "Pasaporte", regla: /^[A-Z0-9]{6,12}$/, ayuda: "El pasaporte tiene de 6 a 12 letras o números.", letras: true, largo: 12 },
};
/** Sin tipo (datos antiguos): 8 a 12 números. */
export const esDocumentoValido = (n: string, tipo?: TipoDoc | null) => (tipo ? DOCUMENTOS[tipo].regla.test(n) : /^\d{8,12}$/.test(n));
/** Deja solo lo que el documento acepta: números (y letras en mayúscula si es pasaporte). */
export const limpiarDocumento = (n: string, tipo?: TipoDoc | null) =>
  tipo && DOCUMENTOS[tipo].letras ? n.toUpperCase().replace(/[^A-Z0-9]/g, "") : n.replace(/\D/g, "");
/** Los documentos para elegir antes de escribir el número */
export const TIPOS_DOC: { valor: TipoDoc; texto: string }[] = (Object.keys(DOCUMENTOS) as TipoDoc[]).map((valor) => ({ valor, texto: DOCUMENTOS[valor].texto }));
/** "DNI", "C.E.", "Cédula" o "Pasaporte" según el tipo elegido; si no hay tipo (datos antiguos), se deduce del largo. */
export const nombreDocumento = (n: string | null | undefined, tipo?: TipoDoc | null) =>
  tipo ? DOCUMENTOS[tipo].corto : !n || n.length === 8 ? "DNI" : "C.E.";
/** Los 2 puestos de trabajador (mismos permisos, distinta pantalla de inicio) */
export const NOMBRE_PUESTO = { oficina: "Cajero de oficina", ruta: "Cobrador de ruta" } as const;
export const DETALLE_PUESTO = {
  oficina: "Cobra en la oficina: empieza en “Registrar pago”.",
  ruta: "Cobra puerta a puerta: empieza en “¿Quién no paga?”, con dirección y mapa de cada cliente.",
} as const;

/** "Cuota diaria" / "Cuota semanal" / "Cuota quincenal" / "Cuota mensual" */
export const nombreCuota = (f: string | null | undefined) => `Cuota ${f === "diario" ? "diaria" : f === "mensual" || f === "quincenal" ? f : "semanal"}`;

/** Frecuencias de cobro, en orden. */
export const FRECUENCIAS: { valor: Frecuencia; texto: string; plural: string }[] = [
  { valor: "diario", texto: "Diario", plural: "diarias" },
  { valor: "semanal", texto: "Semanal", plural: "semanales" },
  { valor: "quincenal", texto: "Quincenal", plural: "quincenales" },
  { valor: "mensual", texto: "Mensual", plural: "mensuales" },
];
/** "DNI 12345678", "C.E. 001234567" o "Sin documento" (clientes del cuaderno que aún no lo tienen) */
export const textoDocumento = (n: string | null | undefined, tipo?: TipoDoc | null) => (n ? `${nombreDocumento(n, tipo)} ${n}` : "Sin documento");

/** Mensajes en palabras simples para los errores de la base de datos */
export const MENSAJE_ERROR: Record<string, string> = {
  OPERACION_REPETIDA: "Este número de operación ya se registró.",
  IMAGEN_REPETIDA: "Esta foto ya se usó en otro pago.",
  MONTO_INVALIDO: "El monto no es válido o es mayor a lo que debe el cliente.",
  SIN_FOTO: "Falta la foto del comprobante.",
  SIN_PERMISO: "No tienes permiso para hacer esto.",
  DEMASIADAS_CONSULTAS: "Hiciste muchas consultas seguidas. Espera unos minutos e inténtalo otra vez.",
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
export const COLOR_HEX: Record<Color, string> = { verde: "#1f7a45", amarillo: "#a64b07", rojo: "#b3322a" };

export function textoSemaforo(color: Color, semanas: number) {
  if (color === "verde" || semanas <= 0) return "Al día";
  return `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
}
