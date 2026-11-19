/** Días que se espera a la placa en trámite antes de pedir el contrato. */
export const DIAS_TRAMITE = 30;

/** Vehículo que estuvo con placa en trámite y ya pasó el plazo sin contrato firmado. */
export interface TramiteVencido {
  contrato_id: string;
  cliente_id: string;
  cliente: string;
  /** null = la placa sigue en trámite */
  placa: string | null;
  /** desde cuándo se cuentan los 30 días (la entrega del vehículo o, si no se anotó, cuando se marcó en trámite) */
  desde: string;
  dias: number;
}

const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

/**
 * Los que ya cumplieron los 30 días y aún no tienen el contrato firmado subido (el aviso no se quita hasta entonces).
 * Más antiguos primero.
 */
export function tramitesVencidos(
  filas: { contrato_id: string; cliente_id: string; cliente: string; placa: string | null; desde: string | null }[],
  firmados: Set<string>,
  hoy: string,
): TramiteVencido[] {
  return filas
    .flatMap((f) => (f.desde && !firmados.has(f.contrato_id) ? [{ ...f, desde: f.desde, dias: diasEntre(f.desde, hoy) }] : []))
    .filter((f) => f.dias >= DIAS_TRAMITE)
    .sort((a, b) => b.dias - a.dias);
}
