import type { Contrato, Cuota } from "@/types/database";

/**
 * Cancelación anticipada: si el cliente paga todo antes del plazo, se le cobra el interés (y el GPS)
 * solo de los meses que usó el vehículo, contados desde la entrega (o la 1.ª cuota si no hay fecha de entrega).
 * El mes que está en curso cuenta completo. El monto se puede corregir antes de registrarlo.
 */
export interface CalculoCancelacion {
  desde: string;
  mesesUsados: number;
  mesesPlazo: number;
  interesUsado: number;
  gpsUsado: number;
  /** capital + interés usado + GPS usado */
  totalUsado: number;
  pagado: number;
  /** lo que falta según el cronograma completo */
  saldo: number;
  /** lo que se sugiere cobrar para cancelar (nunca más que el saldo) */
  sugerido: number;
  ahorro: number;
}

const centimos = (x: number) => Math.round(x * 100) / 100;

/** Meses empezados entre dos fechas (el mes en curso cuenta completo). */
export function mesesEmpezados(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  // meses completos transcurridos; si cae justo en el mismo día del mes, no empieza otro
  const completos = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const justo = d2 === d1 && completos > 0;
  return Math.max(1, justo ? completos : completos + 1);
}

export function calcularCancelacion(
  contrato: Pick<Contrato, "capital" | "interes_pct" | "interes_mes" | "gps_mes" | "fecha_entrega" | "fecha_inicio">,
  cuotas: Pick<Cuota, "monto" | "monto_pagado">[],
  fecha: string,
  mesesPlazo: number,
): CalculoCancelacion | null {
  const pagado = centimos(cuotas.reduce((s, c) => s + c.monto_pagado, 0));
  const saldo = centimos(cuotas.reduce((s, c) => s + c.monto - c.monto_pagado, 0));
  if (contrato.capital == null) return null;
  const desde = contrato.fecha_entrega ?? contrato.fecha_inicio;
  const meses = Math.min(Math.max(1, Math.ceil(mesesPlazo)), mesesEmpezados(desde, fecha));
  const interesMes = contrato.interes_pct != null ? (contrato.capital * contrato.interes_pct) / 100 / 12 : (contrato.interes_mes ?? 0);
  const interesUsado = centimos(interesMes * meses);
  const gpsUsado = centimos((contrato.gps_mes ?? 0) * meses);
  const totalUsado = centimos(contrato.capital + interesUsado + gpsUsado);
  const sugerido = Math.min(saldo, Math.max(0, centimos(totalUsado - pagado)));
  return { desde, mesesUsados: meses, mesesPlazo, interesUsado, gpsUsado, totalUsado, pagado, saldo, sugerido, ahorro: centimos(saldo - sugerido) };
}
