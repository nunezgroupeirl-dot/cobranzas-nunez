/** Campos de la tarjeta de propiedad que salen en el contrato impreso. */
export const CAMPOS_FICHA = ["modelo", "anio", "clase", "combustible", "serie", "motor", "carroceria"] as const;
export type FichaTecnica = Record<(typeof CAMPOS_FICHA)[number], string>;
