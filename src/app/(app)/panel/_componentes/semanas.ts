const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** "2026-10-26" → "26 oct" (el lunes que abre la semana). */
export const etiquetaSemana = (lunes: string) => {
  const [, m, d] = lunes.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
};
