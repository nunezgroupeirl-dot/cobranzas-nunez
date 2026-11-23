import { sumarDias } from "@/components/ui";
import type { Datos } from "@/lib/supabase/datos";
import type { Cliente, Contrato, Frecuencia, MedioPago, Moto } from "@/types/database";

/** Moto y cronograma de un cliente nuevo (todo como texto, tal como se escribe en el formulario). */
export interface Venta {
  /** empresa del vehículo (y de su contrato); "" = la del cliente */
  empresa_id: string;
  tipo: string;
  placa: string;
  tramite: boolean;
  marca: string;
  color: string;
  frecuencia: Frecuencia;
  cuota: string;
  nro_cuotas: string;
  fecha_inicio: string;
  precio: string;
  inicial: string;
  pagadas: string;
  /** capital e interés (solo administradores; el cliente no lo ve). Se activa con un botón: apagado, la cuota se pone a mano.
   *  Hasta S/ 12 000 el interés va en soles por mes; desde S/ 12 001, en % anual proporcional al plazo. */
  usar_capital: boolean;
  capital: string;
  interes: string;
  /** GPS en soles por mes ("" = sin GPS); se suma al precio total */
  gps: string;
  /** fecha en que se entrega el vehículo */
  fecha_entrega: string;
  /** comprobantes de las cuotas que ya venía pagando (obligatorios si hay cuotas pagadas); la foto va aparte */
  comprobantes: ComprobanteVenta[];
  /** venta de varios vehículos con un solo contrato y un solo cronograma (este es el principal) */
  varios: boolean;
  /** los demás vehículos de ese contrato */
  extras: VehiculoExtra[];
}

/** Vehículo adicional de un contrato con varios vehículos (sale en el contrato con sus datos). */
export interface VehiculoExtra {
  clave: string;
  /** ya guardado */
  id?: string;
  tipo: string;
  placa: string;
  tramite: boolean;
  marca: string;
  color: string;
  modelo: string;
  anio: string;
  clase: string;
  combustible: string;
  serie: string;
  motor: string;
  carroceria: string;
}

export const extraVacio = (tipo = "Mototaxi"): VehiculoExtra => ({
  clave: `extra-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  tipo,
  placa: "",
  tramite: false,
  marca: "",
  color: "",
  modelo: "",
  anio: "",
  clase: "",
  combustible: "",
  serie: "",
  motor: "",
  carroceria: "",
});

const extraDe = (m: Moto): VehiculoExtra => ({
  clave: `extra-${m.id}`,
  id: m.id,
  tipo: m.tipo || "Mototaxi",
  placa: m.placa ?? "",
  tramite: !m.placa && !!m.placa_tramite,
  marca: m.marca ?? "",
  color: m.color ?? "",
  modelo: m.modelo ?? "",
  anio: m.anio ? String(m.anio) : "",
  clase: m.clase ?? "",
  combustible: m.combustible ?? "",
  serie: m.serie ?? "",
  motor: m.motor ?? "",
  carroceria: m.carroceria ?? "",
});

/** Un comprobante (voucher, captura o recibo) de cuotas pagadas antes del sistema. */
export interface ComprobanteVenta {
  id: string;
  /** las cuotas que cubre (1, 2, 3…) */
  cuotas: number[];
  fecha: string;
  medio: MedioPago;
  cuenta_id: string;
  nro_operacion: string;
}

export const comprobanteVacio = (hoy: string): ComprobanteVenta => ({
  id: `comp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  cuotas: [],
  fecha: hoy,
  medio: "yape",
  cuenta_id: "",
  nro_operacion: "",
});

/** Las cuotas pagadas que necesitan su comprobante: todas al crear; al editar, solo las que se agregan. */
export function cuotasPorComprobar(v: Venta, pagadasAntes: number): number[] {
  const p = Number(v.pagadas) || 0;
  return p > pagadasAntes ? Array.from({ length: p - pagadasAntes }, (_, i) => pagadasAntes + i + 1) : [];
}

/**
 * Qué falta en los comprobantes (o null si está todo). Cada cuota pagada lleva su propio comprobante,
 * y ninguno puede repetir el N.º de operación ni la captura de otro. `conFoto`: si esa cuota ya tiene su foto.
 */
export function problemaComprobantes(v: Venta, pagadasAntes: number, conFoto: (id: string) => boolean, fotoRepetida: (id: string) => number | null = () => null): string | null {
  const faltan = cuotasPorComprobar(v, pagadasAntes);
  if (!faltan.length) return null;
  const operaciones = new Map<string, number>();
  for (const n of faltan) {
    const c = v.comprobantes.find((x) => x.cuotas.includes(n));
    if (!c || !conFoto(c.id)) return `Falta la captura del comprobante de la cuota ${n}.`;
    const otra = fotoRepetida(c.id);
    if (otra) return `La captura de la cuota ${n} es la misma que la de la cuota ${otra}: cada cuota lleva su propio comprobante.`;
    if (!c.fecha) return `Falta la fecha del pago de la cuota ${n}.`;
    if (c.medio !== "efectivo") {
      if (!c.cuenta_id) return `Elige la cuenta donde llegó el pago de la cuota ${n}.`;
      const op = c.nro_operacion.trim();
      if (!op) return `Escribe el N.º de operación de la cuota ${n}.`;
      if (operaciones.has(op)) return `El N.º de operación ${op} está en la cuota ${operaciones.get(op)} y en la ${n}: cada pago tiene su propio número.`;
      operaciones.set(op, n);
    }
  }
  return null;
}

export const ventaVacia = (hoy: string): Venta => ({
  empresa_id: "",
  tipo: "Mototaxi",
  placa: "",
  tramite: false,
  marca: "",
  color: "",
  frecuencia: "semanal",
  cuota: "",
  nro_cuotas: "",
  fecha_inicio: sumarDias(hoy, 7),
  precio: "",
  inicial: "",
  pagadas: "",
  usar_capital: false,
  capital: "",
  interes: "",
  gps: "",
  fecha_entrega: "",
  comprobantes: [],
  varios: false,
  extras: [],
});

/** Errores por campo (vacío = todo bien). */
export function validarVenta(
  v: Venta,
  pagadasAntes = 0,
  conFoto: (id: string) => boolean = () => false,
  fotoRepetida: (id: string) => number | null = () => null,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.varios) {
    if (!v.extras.length) e.extras = "Agrega los otros vehículos de este contrato (o quita la opción de varios vehículos).";
    else
      for (const [i, x] of v.extras.entries()) {
        const n = `Vehículo ${i + 2}`;
        if (!x.tramite && !x.placa.trim()) e.extras ??= `${n}: escribe la placa o marca «Placa en trámite».`;
        else if (!x.tramite && !/^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/i.test(x.placa.trim())) e.extras ??= `${n}: escribe bien la placa (ej.: 1234-AB).`;
        else if (!x.marca.trim()) e.extras ??= `${n}: falta la marca.`;
      }
    const placas = [v.tramite ? "" : v.placa, ...v.extras.map((x) => (x.tramite ? "" : x.placa))].map((p) => p.trim().toUpperCase().replace("-", "")).filter(Boolean);
    if (new Set(placas).size !== placas.length) e.extras ??= "Hay una placa repetida entre los vehículos de este contrato.";
  }
  const comp = problemaComprobantes(v, pagadasAntes, conFoto, fotoRepetida);
  if (comp) e.comprobantes = comp;
  // obligatorio: o la placa o "Placa en trámite" marcado
  if (!v.tramite && !v.placa.trim()) e.placa = "Escribe la placa o marca «Placa en trámite».";
  else if (!v.tramite && !/^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/i.test(v.placa.trim())) e.placa = "Escribe la placa (ej.: 1234-AB).";
  // con placa en trámite el vehículo puede no estar entregado: marca y color quedan para después (salen en Datos pendientes)
  if (!v.tramite && !v.marca.trim()) e.marca = "Escribe la marca.";
  const nro = Number(v.nro_cuotas);
  if (!(Number(v.cuota) > 0)) e.cuota = "Escribe la cuota.";
  if (!Number.isInteger(nro) || nro < 1 || nro > 1000) e.nro_cuotas = "Entre 1 y 1000 cuotas.";
  if (!v.fecha_inicio) e.fecha_inicio = "Elige la fecha de la 1.ª cuota.";
  const pagadas = v.pagadas ? Number(v.pagadas) : 0;
  if (!Number.isInteger(pagadas) || pagadas < 0 || (nro > 0 && pagadas > nro)) e.pagadas = "No puede ser más que el número de cuotas.";
  if (!v.usar_capital) return e;
  if (!(Number(v.capital) > 0)) e.capital = "Escribe el capital prestado.";
  if (v.gps.trim() && !(Number(v.gps) >= 0)) e.gps = "Escribe un monto válido.";
  if (v.capital.trim() && !v.interes.trim()) e.interes = "Escribe el interés (puede ser 0).";
  else if (v.interes.trim() && interesEnPorcentaje(v.capital) && !(Number(v.interes) >= 0 && Number(v.interes) <= 500)) e.interes = "Entre 0 % y 500 %.";
  else if (v.interes.trim() && !(Number(v.interes) >= 0)) e.interes = "Escribe un monto válido.";
  return e;
}

/**
 * Tres tramos según el capital (como lo resolvió el administrador):
 *  - menos de S/ 2 500 → 20 % del capital por mes;
 *  - de S/ 2 500 a S/ 12 000 → S/ 500 de interés por mes (+ S/ 3 de GPS = 503);
 *  - más de S/ 12 000 → 50 % al año (a 12 meses se calcula por día: total ÷ 12 ÷ 30).
 * Sin redondeos: se cuenta al céntimo. El interés de cada tramo se puede cambiar.
 */
export const CAPITAL_MINIMO = 2500;
export const CAPITAL_TOPE = 12000;
export const INTERES_BAJO_PCT_DEFECTO = "20";
export const INTERES_MES_DEFECTO = "500";
export const INTERES_PCT_DEFECTO = "50";
export const GPS_MES_DEFECTO = "3.00";
export type Tramo = "bajo" | "medio" | "alto";
export const tramoDe = (capital: string): Tramo => (Number(capital) > CAPITAL_TOPE ? "alto" : Number(capital) < CAPITAL_MINIMO ? "bajo" : "medio");
/** Interés automático según el tramo: 20 % por mes, S/ 500 por mes o 50 % al año. */
export const interesPorDefecto = (capital: string) =>
  ({ bajo: INTERES_BAJO_PCT_DEFECTO, medio: INTERES_MES_DEFECTO, alto: INTERES_PCT_DEFECTO })[tramoDe(capital)];
/** El interés se escribe en % (tramos bajo y alto) o en soles por mes (tramo medio). */
export const interesEnPorcentaje = (capital: string) => tramoDe(capital) !== "medio";

/**
 * Semanas que tiene cada plazo en meses, tal como lo indicó el administrador (1 mes = 4 semanas … 12 meses = 52).
 * Más de 12 meses: 52 semanas por año, redondeado.
 */
export const SEMANAS_POR_MESES: Record<number, number> = { 1: 4, 2: 9, 3: 13, 4: 17, 5: 21, 6: 26, 7: 30, 8: 34, 9: 39, 10: 43, 11: 47, 12: 52 };
export const semanasDeMeses = (meses: number) => SEMANAS_POR_MESES[meses] ?? Math.round((meses * 52) / 12);

/** N.º de cuotas para un plazo en meses, según la frecuencia de cobro. */
export function cuotasDelPlazo(meses: number, frecuencia: Frecuencia): number {
  if (frecuencia === "mensual") return meses;
  if (frecuencia === "quincenal") return meses * 2;
  // diario: se cobran los días de las semanas del plazo (12 meses = 52 semanas = 364 días); la cuota sale de 30 días por mes
  if (frecuencia === "diario") return semanasDeMeses(meses) * 7;
  return semanasDeMeses(meses);
}

/** Cuántos meses dura el contrato según el n.º de cuotas y la frecuencia (con la tabla de semanas del administrador). */
export function mesesDelPlazo(nroCuotas: number, frecuencia: Frecuencia): number {
  if (frecuencia === "semanal" || frecuencia === "diario") {
    const por = frecuencia === "diario" ? 7 : 1;
    const exacto = Object.entries(SEMANAS_POR_MESES).find(([, semanas]) => semanas * por === nroCuotas);
    if (exacto) return Number(exacto[0]);
  }
  const meses = frecuencia === "mensual" ? nroCuotas : frecuencia === "quincenal" ? nroCuotas / 2 : frecuencia === "diario" ? nroCuotas / 30 : (nroCuotas * 12) / 52;
  return Math.round(meses * 100) / 100;
}

const centimos = (x: number) => Math.round(x * 100) / 100;

/** La cuota con capital e interés sube siempre al siguiente décimo de sol (0.10). */
export const PASO_CUOTA = 0.1;

/** Redondeo a favor de la empresa: hacia arriba al siguiente múltiplo (0.10 o 0.50). */
export function redondearArriba(x: number, paso: number): number {
  const centavos = Math.round(x * 100);
  const p = Math.round(paso * 100);
  return (Math.ceil(centavos / p) * p) / 100;
}

/**
 * Precio total y cuota a partir del capital, el plazo y el tramo (las hojas del administrador):
 *  - más de S/ 12 000 a 12 meses → por día: (capital + 50 %) ÷ 12 ÷ 30, al céntimo → × 7 la semana, × 52 semanas
 *    (13 000 → 54.17 al día → 379.19 a la semana). El GPS lo cubren los días de más (364 en vez de 360).
 *  - los demás → interés del mes × meses + capital + GPS S/ 3 × meses, ÷ cuotas, y la cuota sube al siguiente 0.10.
 *  - cobro diario → total ÷ (meses × 30), al céntimo; se cobran los días de las semanas del plazo (12 meses = 364).
 * El precio total es lo que de verdad se cobra: cuota × n.º de cuotas.
 */
export function calcularConInteres(v: Pick<Venta, "capital" | "interes" | "nro_cuotas" | "frecuencia" | "gps">) {
  const c = Number(v.capital);
  const i = Number(v.interes);
  const n = Number(v.nro_cuotas);
  if (!(c > 0) || !v.interes.trim() || !(i >= 0) || !(Number.isInteger(n) && n > 0)) return null;
  const meses = mesesDelPlazo(n, v.frecuencia);
  const tramo = tramoDe(v.capital);
  const porcentaje = tramo !== "medio";
  const porDia = tramo === "alto" && meses === 12 && (v.frecuencia === "semanal" || v.frecuencia === "diario");

  if (porDia) {
    const diaria = centimos((c * (1 + i / 100)) / 12 / 30);
    // la cuota siempre sube al siguiente 0.10 (a favor de la empresa)
    const cuota = redondearArriba(v.frecuencia === "diario" ? diaria : diaria * 7, PASO_CUOTA);
    const total = centimos(cuota * n);
    const interesSoles = centimos((c * i) / 100);
    return { tramo, porcentaje, porDia, meses, interesMes: centimos(interesSoles / 12), interesSoles, gpsSoles: 0, calculado: centimos(c + interesSoles), total, cuota, diaria, diasGps: 0 };
  }

  const interesMes = centimos(tramo === "alto" ? (c * i) / 100 / 12 : tramo === "bajo" ? (c * i) / 100 : i);
  const interesSoles = centimos(interesMes * meses);
  if (v.frecuencia === "diario") {
    // los días de más (12 meses = 364 en vez de 360) son el GPS
    const base = c + interesSoles;
    // la cuota siempre sube al siguiente 0.10 (a favor de la empresa)
    const cuota = redondearArriba(base / Math.max(1, Math.round(meses * 30)), PASO_CUOTA);
    const total = centimos(cuota * n);
    return { tramo, porcentaje, porDia, meses, interesMes, interesSoles, gpsSoles: centimos(total - base), calculado: centimos(base), total, cuota, diaria: cuota, diasGps: Math.max(0, n - Math.round(meses * 30)) };
  }
  const gpsSoles = centimos((Number(v.gps) || 0) * meses);
  const calculado = centimos(c + interesSoles + gpsSoles);
  // la cuota siempre sube al siguiente 0.10 (a favor de la empresa); el precio total se rehace con esa cuota
  const cuota = redondearArriba(calculado / n, PASO_CUOTA);
  return { tramo, porcentaje, porDia, meses, interesMes, interesSoles, gpsSoles, calculado, total: centimos(cuota * n), cuota, diaria: 0, diasGps: 0 };
}

/** Si cambió el capital o el interés, se guarda aparte (lo hace solo un administrador). */
async function guardarCapitalSiCambio(
  datos: Datos,
  contratoId: string,
  v: Venta,
  antes?: Pick<Contrato, "capital" | "interes_pct" | "interes_mes" | "gps_mes" | "fecha_entrega">,
) {
  // con el botón apagado no se guarda capital ni interés (si había, se quitan)
  const usa = v.usar_capital && v.capital.trim() !== "";
  const capital = usa ? Number(v.capital) : null;
  const interes = usa && v.interes.trim() ? Number(v.interes) : null;
  const pct = usa && interesEnPorcentaje(v.capital) ? interes : null;
  const mes = usa && !interesEnPorcentaje(v.capital) ? interes : null;
  const gps = usa && v.gps.trim() ? Number(v.gps) : null;
  const entrega = v.fecha_entrega || null;
  if (
    capital === (antes?.capital ?? null) &&
    pct === (antes?.interes_pct ?? null) &&
    mes === (antes?.interes_mes ?? null) &&
    gps === (antes?.gps_mes ?? null) &&
    entrega === (antes?.fecha_entrega ?? null)
  )
    return;
  await datos.guardarCapital(contratoId, { capital, interesPct: pct, interesMes: mes, gpsMes: gps, fechaEntrega: entrega });
}

/** Lo ya guardado en un intento anterior: si algo falla a la mitad, al reintentar no se duplica la moto. */
export interface Hechos {
  moto?: Moto;
  contratoId?: string;
  /** vehículos adicionales ya guardados (clave del formulario → id), para no repetirlos al reintentar */
  extras?: Record<string, string>;
}

/**
 * Los demás vehículos de un contrato con varios: se crean o actualizan ligados al contrato (misma empresa que el
 * principal); los que se quitaron del formulario se eliminan. Sin "varios", se quitan todos.
 */
export async function guardarExtras(datos: Datos, cliente: Cliente, v: Venta, contratoId: string, empresaId: string, antes: Moto[], hechos: Hechos) {
  hechos.extras ??= {};
  const lista = v.varios ? v.extras : [];
  for (const x of lista) {
    const id = x.id ?? hechos.extras[x.clave];
    const anio = Number(x.anio);
    // react-doctor-disable-next-line async-await-in-loop
    const m = await datos.guardarMoto({
      ...(id ? { id } : {}),
      cliente_id: cliente.id,
      empresa_id: empresaId,
      contrato_id: contratoId,
      placa: x.tramite ? null : x.placa.trim().toUpperCase(),
      placa_tramite: x.tramite,
      tipo: x.tipo,
      marca: x.marca.trim(),
      color: x.color.trim(),
      modelo: x.modelo.trim() || null,
      anio: Number.isInteger(anio) && anio > 1900 ? anio : null,
      clase: x.clase.trim() || null,
      combustible: x.combustible.trim() || null,
      serie: x.serie.trim() || null,
      motor: x.motor.trim() || null,
      carroceria: x.carroceria.trim() || null,
    } as Moto);
    hechos.extras[x.clave] = m.id;
  }
  const quedan = new Set(lista.map((x) => x.id ?? hechos.extras?.[x.clave]));
  for (const m of antes.filter((y) => !quedan.has(y.id))) {
    // react-doctor-disable-next-line async-await-in-loop
    await datos.eliminarMoto(m.id);
  }
}

/** Registra la moto y crea el cronograma (contrato sin llenar). Devuelve el id del contrato. */
export async function guardarVenta(datos: Datos, cliente: Cliente, v: Venta, hechos: Hechos): Promise<string> {
  const opcional = (x: string) => (x.trim() ? Number(x) : null);
  hechos.moto ??= await datos.guardarMoto({
    cliente_id: cliente.id,
    empresa_id: v.empresa_id || cliente.empresa_id,
    placa: v.tramite ? null : v.placa,
    placa_tramite: v.tramite,
    tipo: v.tipo,
    marca: v.marca.trim(),
    color: v.color.trim(),
  });
  hechos.contratoId ??= await datos.crearContrato({
    cliente_id: cliente.id,
    moto_id: hechos.moto.id,
    monto_cuota: Number(v.cuota),
    nro_cuotas: Number(v.nro_cuotas),
    fecha_inicio: v.fecha_inicio,
    frecuencia: v.frecuencia,
    precio_total: opcional(v.precio),
    inicial: opcional(v.inicial),
    cuotas_pagadas: v.pagadas ? Number(v.pagadas) : 0,
  });
  await guardarCapitalSiCambio(datos, hechos.contratoId, v);
  return hechos.contratoId;
}

/** Un vehículo que el cliente ya tiene, con su contrato (si tiene). */
export interface VentaActual {
  moto: Moto | null;
  contrato: Contrato | null;
  /** contrato con varios vehículos: los demás */
  extras?: Moto[];
}

/** Los vehículos del cliente para editarlos: uno por contrato (los activos primero) y los que aún no tienen contrato. */
export async function cargarVehiculos(datos: Datos, clienteId: string): Promise<VentaActual[]> {
  const [contratos, motos] = await Promise.all([datos.contratos(), datos.motos()]);
  const suyos = contratos
    .filter((c) => c.cliente_id === clienteId && c.estado !== "anulado")
    .sort((a, b) => Number(b.estado === "activo") - Number(a.estado === "activo") || a.creado_en.localeCompare(b.creado_en));
  const conContrato = new Set(suyos.map((c) => c.moto_id));
  const porId = new Map(motos.map((m) => [m.id, m]));
  return [
    ...suyos.map((contrato) => ({
      moto: porId.get(contrato.moto_id) ?? null,
      contrato,
      extras: motos.filter((m) => m.contrato_id === contrato.id && m.id !== contrato.moto_id).sort((a, b) => (a.creado_en ?? "").localeCompare(b.creado_en ?? "")),
    })),
    // los vehículos adicionales de un contrato van con su contrato, no sueltos
    ...motos.filter((m) => m.cliente_id === clienteId && !m.archivado && !m.contrato_id && !conContrato.has(m.id)).map((moto) => ({ moto, contrato: null })),
  ];
}

const texto = (n: number | null | undefined) => (n == null ? "" : String(n));

/** El formulario lleno con la moto y el contrato que ya tiene. */
export function ventaDe(hoy: string, { moto, contrato, extras = [] }: VentaActual): Venta {
  const base = ventaVacia(hoy);
  return {
    ...base,
    ...(moto
      ? {
          empresa_id: moto.empresa_id,
          tipo: moto.tipo || "Otro",
          placa: moto.placa ?? "",
          tramite: !moto.placa && !!moto.placa_tramite,
          marca: moto.marca,
          color: moto.color,
        }
      : {}),
    ...(contrato
      ? {
          frecuencia: contrato.frecuencia ?? "semanal",
          cuota: texto(contrato.monto_cuota),
          nro_cuotas: texto(contrato.nro_cuotas),
          fecha_inicio: contrato.fecha_inicio,
          precio: texto(contrato.precio_total),
          inicial: texto(contrato.inicial),
          pagadas: contrato.cuotas_pagadas_inicial ? String(contrato.cuotas_pagadas_inicial) : "",
          usar_capital: contrato.capital != null,
          capital: texto(contrato.capital),
          interes: texto(contrato.interes_pct ?? contrato.interes_mes),
          gps: texto(contrato.gps_mes),
          fecha_entrega: contrato.fecha_entrega ?? "",
          varios: extras.length > 0,
          extras: extras.map(extraDe),
        }
      : {}),
  };
}

/** Al editar: actualiza la moto y el cronograma solo si cambiaron; si aún no tenía, los crea. */
export async function guardarEdicion(datos: Datos, cliente: Cliente, v: Venta, actual: VentaActual, hechos: Hechos): Promise<void> {
  const { moto, contrato } = actual;
  if (moto && !hechos.moto) {
    const placa = v.tramite ? null : v.placa.trim().toUpperCase() || null;
    const empresa = v.empresa_id || cliente.empresa_id;
    const cambio =
      placa !== moto.placa ||
      v.tramite !== !!moto.placa_tramite ||
      v.tipo !== moto.tipo ||
      v.marca.trim() !== moto.marca ||
      v.color.trim() !== moto.color ||
      empresa !== moto.empresa_id;
    // si cambia la empresa, su contrato pasa con él (lo hace la base; no se puede si ya tiene pagos)
    hechos.moto = cambio
      ? await datos.guardarMoto({ ...moto, empresa_id: empresa, placa, placa_tramite: v.tramite, tipo: v.tipo, marca: v.marca.trim(), color: v.color.trim() })
      : moto;
  }
  if (!contrato) {
    await guardarVenta(datos, cliente, v, hechos);
    return;
  }
  const nuevo = {
    monto_cuota: Number(v.cuota),
    nro_cuotas: Number(v.nro_cuotas),
    fecha_inicio: v.fecha_inicio,
    precio_total: v.precio.trim() ? Number(v.precio) : null,
    inicial: v.inicial.trim() ? Number(v.inicial) : null,
    cuotas_pagadas: v.pagadas ? Number(v.pagadas) : 0,
    frecuencia: v.frecuencia,
  };
  const cambio =
    nuevo.monto_cuota !== contrato.monto_cuota ||
    nuevo.nro_cuotas !== contrato.nro_cuotas ||
    nuevo.fecha_inicio !== contrato.fecha_inicio ||
    nuevo.precio_total !== contrato.precio_total ||
    nuevo.inicial !== contrato.inicial ||
    nuevo.cuotas_pagadas !== contrato.cuotas_pagadas_inicial ||
    nuevo.frecuencia !== (contrato.frecuencia ?? "semanal");
  // rehace el cronograma y vuelve a aplicar los pagos ya registrados
  if (cambio) await datos.editarContrato(contrato.id, { ...nuevo, observaciones: contrato.observaciones });
  await guardarCapitalSiCambio(datos, contrato.id, v, contrato);
}
