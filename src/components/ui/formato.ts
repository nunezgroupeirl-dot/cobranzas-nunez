import type { Color, EstadoCuota, Frecuencia, MedioPago, TipoDoc, TipoDocumento } from "@/types/database";

const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });

export const formatoSoles = (n: number | null | undefined) => soles.format(n ?? 0);

/** "2026-10-15" → "15/10/2026" (sin pasar por zona horaria) */
export function formatoFecha(f: string | null | undefined): string {
  if (!f) return "—";
  const [a, m, d] = f.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const esFecha = (f: string | null | undefined): f is string => !!f && /^\d{4}-\d{2}-\d{2}/.test(f);

/** "lunes", "martes"… de una fecha YYYY-MM-DD (sin depender de la zona horaria del equipo). */
export function diaSemana(f: string | null | undefined): string {
  if (!esFecha(f)) return "";
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** "Lunes 23 de noviembre de 2026": para que se vea claro qué día es. */
export function fechaLarga(f: string | null | undefined): string {
  if (!esFecha(f)) return "";
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  const dia = diaSemana(f);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d} de ${MESES[m - 1]} de ${a}`;
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
  tarjeta_frente: "Tarjeta de propiedad (frente)",
  tarjeta_reverso: "Tarjeta de propiedad (reverso)",
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

/** Fecha de hoy en Lima (YYYY-MM-DD). El día cambia a medianoche. */
export function fechaLima(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** Fecha de hoy en Lima para pagos y cuotas: igual que fechaLima (lo pagado después de medianoche es del día siguiente). */
export function hoyLima(ahora: Date = new Date()): string {
  return fechaLima(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(new Date(`${fecha}T00:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Colores del semáforo para bordes y acentos (los mismos de globals.css) */
export const COLOR_HEX: Record<Color, string> = { verde: "#1f7a45", amarillo: "#a64b07", rojo: "#b3322a" };

/** Cómo se cuenta el atraso según cada cuánto paga: 1 cuota diaria vencida = 1 día, 1 semanal = 1 semana… */
const UNIDAD_ATRASO: Record<Frecuencia, [string, string]> = {
  diario: ["día", "días"],
  semanal: ["semana", "semanas"],
  quincenal: ["quincena", "quincenas"],
  mensual: ["mes", "meses"],
};

/** "Al día", "3 días", "1 semana", "2 quincenas", "1 mes": cuotas vencidas en la unidad de su cronograma. */
export function textoSemaforo(color: Color, cuotasVencidas: number, frecuencia?: Frecuencia | null) {
  if (color === "verde" || cuotasVencidas <= 0) return "Al día";
  const [una, varias] = UNIDAD_ATRASO[frecuencia ?? "semanal"] ?? UNIDAD_ATRASO.semanal;
  return `${cuotasVencidas} ${cuotasVencidas === 1 ? una : varias}`;
}
