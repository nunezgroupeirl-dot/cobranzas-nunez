import { sumarDias } from "@/components/ui";
import type { Datos } from "@/lib/supabase/datos";
import type { Cliente, Contrato, Frecuencia, Moto } from "@/types/database";

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
});

/** Errores por campo (vacío = todo bien). */
export function validarVenta(v: Venta): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.tramite && v.placa.trim() && !/^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/i.test(v.placa.trim())) e.placa = "Escribe la placa (ej.: 1234-AB).";
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
 * Todo se redondea a favor de la empresa. El interés de cada tramo se puede cambiar.
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

/** Redondeo a favor de la empresa: hacia arriba al siguiente múltiplo (0.10 o 0.50). */
export function redondearArriba(x: number, paso: number): number {
  const centavos = Math.round(x * 100);
  const p = Math.round(paso * 100);
  return (Math.ceil(centavos / p) * p) / 100;
}

/**
 * Precio total y cuota a partir del capital, el plazo y el tramo (las hojas del administrador):
 *  - más de S/ 12 000 a 12 meses → por día: (capital + 50 %) ÷ 12 ÷ 30, sube a 0.10 → × 7 la semana, × 52 semanas
 *    (13 000 → 54.20 al día → 379.40 a la semana). El GPS lo cubren los días de más (364 en vez de 360).
 *  - los demás → interés del mes (sube a 0.10) × meses + capital + GPS S/ 3 × meses, ÷ cuotas; la cuota sube a 0.50
 *    (17 000 a 5 meses → 708.40 × 5 + 17 000 + 15 = 20 557 ÷ 21 = 978.90 → 979).
 *  - cobro diario → total ÷ (meses × 30), sube a 0.10; se cobran los días de las semanas del plazo (12 meses = 364).
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
    const diaria = redondearArriba((c * (1 + i / 100)) / 12 / 30, 0.1);
    const cuota = v.frecuencia === "diario" ? diaria : centimos(diaria * 7);
    const total = centimos(cuota * n);
    const interesSoles = centimos((c * i) / 100);
    return { tramo, porcentaje, porDia, meses, interesMes: centimos(interesSoles / 12), interesSoles, gpsSoles: 0, calculado: centimos(c + interesSoles), total, cuota, diaria, diasGps: 0 };
  }

  const interesMes = redondearArriba(tramo === "alto" ? (c * i) / 100 / 12 : tramo === "bajo" ? (c * i) / 100 : i, 0.1);
  const interesSoles = centimos(interesMes * meses);
  if (v.frecuencia === "diario") {
    // los días de más (12 meses = 364 en vez de 360) son el GPS
    const base = c + interesSoles;
    const cuota = redondearArriba(base / Math.max(1, Math.round(meses * 30)), 0.1);
    const total = centimos(cuota * n);
    return { tramo, porcentaje, porDia, meses, interesMes, interesSoles, gpsSoles: centimos(total - base), calculado: centimos(base), total, cuota, diaria: cuota, diasGps: Math.max(0, n - Math.round(meses * 30)) };
  }
  const gpsSoles = centimos((Number(v.gps) || 0) * meses);
  const calculado = centimos(c + interesSoles + gpsSoles);
  const cuota = redondearArriba(calculado / n, 0.5);
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
    ...suyos.map((contrato) => ({ moto: porId.get(contrato.moto_id) ?? null, contrato })),
    ...motos.filter((m) => m.cliente_id === clienteId && !m.archivado && !conContrato.has(m.id)).map((moto) => ({ moto, contrato: null })),
  ];
}

const texto = (n: number | null | undefined) => (n == null ? "" : String(n));

/** El formulario lleno con la moto y el contrato que ya tiene. */
export function ventaDe(hoy: string, { moto, contrato }: VentaActual): Venta {
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
