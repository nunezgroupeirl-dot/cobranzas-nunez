/**
 * Cierre de sesión por inactividad: a los 20 minutos sin tocar nada, la sesión se cierra sola y la página
 * vuelve al ingreso. La última actividad se guarda en el navegador para que valga en todas las pestañas
 * y aunque el celular haya estado dormido (al volver se revisa enseguida).
 */
export const MINUTOS_INACTIVIDAD = 20;
const LIMITE_MS = MINUTOS_INACTIVIDAD * 60_000;
const CLAVE = "cn-ultima-actividad";

export function marcarActividad(): void {
  try {
    localStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    /* navegador sin almacenamiento: se usa solo el reloj de esta pestaña */
  }
}

export function ultimaActividad(): number | null {
  try {
    const v = Number(localStorage.getItem(CLAVE));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export const vencioPorInactividad = (desde: number | null) => desde !== null && Date.now() - desde >= LIMITE_MS;
