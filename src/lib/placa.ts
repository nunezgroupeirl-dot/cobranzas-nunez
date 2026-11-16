/** Tipos de vehículo (cada uno tiene su ícono). */
export const TIPOS_MOTO = ["Mototaxi", "Lineal", "Scooter", "Auto", "Camioneta", "Combi", "Minivan", "Otro"];

/** "EN TRÁMITE" escrito en la placa no es una placa: se guarda como placa en trámite. */
export const ES_TRAMITE = /TR[AÁ]MITE/i;

/** Normaliza placa y "en trámite": con placa ya no está en trámite. */
export function normalizarPlaca(placa: string | null | undefined, tramite?: boolean | null): { placa: string | null; placa_tramite: boolean } {
  const p = placa?.trim().toUpperCase() || null;
  if (p && ES_TRAMITE.test(p)) return { placa: null, placa_tramite: true };
  return { placa: p, placa_tramite: p ? false : !!tramite };
}

/** Sin los archivados (ya no están en la empresa): para las listas del día a día. */
export const vigentes = <T extends { archivado?: boolean }>(xs: T[]) => xs.filter((x) => !x.archivado);
