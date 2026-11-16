/**
 * Reglas del sistema, copia en TypeScript de lo que hace supabase/esquema.sql
 * (recalcular_contrato, registrar_pago, vistas). Solo las usa el modo de DATOS DE PRUEBA
 * (simulado.ts). Las pantallas NUNCA usan esto para decidir a qué cuota va un pago.
 */
import type { Color, Contrato, Cuota, EstadoCuota, ErrorPago, Pago, RegistrarPagoArgs } from "@/types/database";

const MS_DIA = 86_400_000;
const OFFSET_LIMA_MS = 5 * 3_600_000; // Lima es UTC-5 todo el año
const CORTE_MINUTOS = 22 * 60; // 10:00 p.m.

/** Fecha (YYYY-MM-DD) a la que cuenta algo registrado ahora. Después de las 10:00 p.m. (Lima) cuenta para el día siguiente. */
export function fechaOperativaLima(ahora: Date = new Date()): string {
  const lima = new Date(ahora.getTime() - OFFSET_LIMA_MS);
  const minutos = lima.getUTCHours() * 60 + lima.getUTCMinutes();
  const base = minutos > CORTE_MINUTOS ? new Date(lima.getTime() + MS_DIA) : lima;
  return base.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  return new Date(d.getTime() + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Lunes de la semana de una fecha (para "cobrado en la semana"). */
export function inicioSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return sumarDias(fecha, -dia);
}

export const aCentimos = (n: number) => Math.round(n * 100);
export const deCentimos = (c: number) => c / 100;

/** Fecha de la cuota i (desde 0), igual que generar_cuotas en la base: diario cada día, semanal cada 7 días, mensual el mismo día, quincenal 2 por mes. */
export function fechaCuota(inicio: string, i: number, frecuencia: Contrato["frecuencia"] = "semanal"): string {
  if (frecuencia === "diario") return sumarDias(inicio, i);
  if (frecuencia === "semanal" || !frecuencia) return sumarDias(inicio, i * 7);
  const meses = frecuencia === "mensual" ? i : Math.floor(i / 2);
  const [a, m, d] = inicio.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate(); // último día de ese mes (como make_interval)
  const base = new Date(Date.UTC(a, m - 1 + meses, Math.min(d, fin))).toISOString().slice(0, 10);
  return frecuencia === "quincenal" && i % 2 === 1 ? sumarDias(base, 15) : base;
}

export function generarCuotas(contrato: Pick<Contrato, "id" | "monto_cuota" | "nro_cuotas" | "fecha_inicio" | "frecuencia">): Omit<Cuota, "id">[] {
  return Array.from({ length: contrato.nro_cuotas }, (_, i) => ({
    contrato_id: contrato.id,
    numero: i + 1,
    fecha_vencimiento: fechaCuota(contrato.fecha_inicio, i, contrato.frecuencia),
    monto: contrato.monto_cuota,
    monto_pagado: 0,
    fecha_pago: null,
    estado: "pendiente" as EstadoCuota,
  }));
}

type PagoReparto = Pick<Pago, "monto" | "fecha_pago" | "creado_en" | "anulado" | "cuotas_anteriores"> & { id?: string };

/**
 * El mismo reparto que recalcular_contrato: cuánto pone cada pago en cada cuota.
 * Primero los comprobantes de cuotas del cuaderno (van a esas cuotas), luego los demás pagos
 * en orden de fecha, siempre a la cuota pendiente más antigua.
 */
function repartir<C extends Pick<Cuota, "numero" | "monto">>(ordenadas: C[], pagos: PagoReparto[], pagadasIniciales: number) {
  const validos = pagos
    .filter((p) => !p.anulado)
    .sort(
      (a, b) =>
        Number(!a.cuotas_anteriores) - Number(!b.cuotas_anteriores) ||
        (a.fecha_pago === b.fecha_pago ? a.creado_en.localeCompare(b.creado_en) : a.fecha_pago.localeCompare(b.fecha_pago)),
    );
  // cuotas del cuaderno que ya tienen su comprobante: las cubre ese pago, no la carga inicial
  const conComprobante = new Set(validos.flatMap((p) => p.cuotas_anteriores ?? []));
  const pagado = ordenadas.map((c) => (c.numero <= pagadasIniciales && !conComprobante.has(c.numero) ? aCentimos(c.monto) : 0));
  const fechaPago: (string | null)[] = ordenadas.map(() => null);
  const aportes: { pago: PagoReparto; monto: number }[][] = ordenadas.map(() => []);

  for (const p of validos) {
    let resto = aCentimos(p.monto);
    const destino = p.cuotas_anteriores ? new Set(p.cuotas_anteriores) : null;
    for (let i = 0; i < ordenadas.length && resto > 0; i++) {
      if (destino && !destino.has(ordenadas[i].numero)) continue;
      const falta = aCentimos(ordenadas[i].monto) - pagado[i];
      if (falta <= 0) continue;
      const aplica = Math.min(falta, resto);
      pagado[i] += aplica;
      resto -= aplica;
      aportes[i].push({ pago: p, monto: deCentimos(aplica) });
      if (pagado[i] === aCentimos(ordenadas[i].monto)) fechaPago[i] = p.fecha_pago;
    }
  }
  return { pagado, fechaPago, aportes };
}

/** Qué pagos cubren cada cuota (n.º de cuota → pagos con lo que aportó cada uno): para ver su voucher. */
export function pagosPorCuota<P extends PagoReparto & { id: string }>(
  cuotas: Pick<Cuota, "numero" | "monto">[],
  pagos: P[],
  pagadasIniciales = 0,
): Map<number, { pago: P; monto: number }[]> {
  const ordenadas = [...cuotas].sort((a, b) => a.numero - b.numero);
  const { aportes } = repartir(ordenadas, pagos, pagadasIniciales);
  return new Map(ordenadas.map((c, i) => [c.numero, aportes[i] as { pago: P; monto: number }[]]));
}

/**
 * Reparte los pagos (no anulados) sobre las cuotas y calcula el estado de cada una
 * con la fecha real de pago.
 */
export function aplicarPagos<C extends Omit<Cuota, "estado" | "monto_pagado" | "fecha_pago">>(
  cuotas: C[],
  pagos: PagoReparto[],
  hoy: string,
  pagadasIniciales = 0, // cuotas que ya estaban pagadas al pasar del cuaderno
): (C & Pick<Cuota, "estado" | "monto_pagado" | "fecha_pago">)[] {
  const ordenadas = [...cuotas].sort((a, b) => a.numero - b.numero);
  const { pagado, fechaPago } = repartir(ordenadas, pagos, pagadasIniciales);

  return ordenadas.map((c, i) => {
    const completa = pagado[i] === aCentimos(c.monto);
    let estado: EstadoCuota;
    if (completa) estado = (fechaPago[i] ?? "") <= c.fecha_vencimiento ? "pagada_a_tiempo" : "pagada_con_atraso";
    else estado = c.fecha_vencimiento < hoy ? "vencida" : "pendiente";
    return { ...c, monto_pagado: deCentimos(pagado[i]), fecha_pago: completa ? fechaPago[i] : null, estado };
  });
}

export function colorPorSemanas(semanas: number): Color {
  if (semanas <= 0) return "verde";
  if (semanas <= 3) return "amarillo";
  return "rojo";
}

export function resumenCuotas(cuotas: Pick<Cuota, "estado" | "monto" | "monto_pagado" | "fecha_vencimiento">[]) {
  const vencidas = cuotas.filter((c) => c.estado === "vencida");
  const semanas_atraso = vencidas.length;
  const deuda = deCentimos(vencidas.reduce((s, c) => s + aCentimos(c.monto) - aCentimos(c.monto_pagado), 0));
  const saldo = deCentimos(
    cuotas.filter((c) => c.estado === "vencida" || c.estado === "pendiente").reduce((s, c) => s + aCentimos(c.monto) - aCentimos(c.monto_pagado), 0),
  );
  const proxima = cuotas.find((c) => c.estado === "pendiente");
  return { semanas_atraso, deuda, saldo, color: colorPorSemanas(semanas_atraso), proxima_cuota: proxima?.fecha_vencimiento ?? null };
}

/** Validaciones que hace registrar_pago antes de guardar. */
export function validarPago(
  args: RegistrarPagoArgs,
  pagosExistentes: Pick<Pago, "nro_operacion" | "foto_hash" | "anulado">[],
  saldoPendiente: number,
): ErrorPago | null {
  if (!args.foto_ruta || !args.foto_hash) return "SIN_FOTO";
  if (!(args.monto > 0) || aCentimos(args.monto) > aCentimos(saldoPendiente)) return "MONTO_INVALIDO";
  const vivos = pagosExistentes.filter((p) => !p.anulado);
  const nro = args.nro_operacion?.trim();
  if (args.medio !== "efectivo" && nro && vivos.some((p) => p.nro_operacion?.trim() === nro)) return "OPERACION_REPETIDA";
  if (vivos.some((p) => p.foto_hash === args.foto_hash)) return "IMAGEN_REPETIDA";
  return null;
}
