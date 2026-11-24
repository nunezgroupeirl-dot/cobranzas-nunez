import type { Frecuencia } from "@/types/database";
import { interesEnPorcentaje } from "../../../clientes/_componentes/venta";

/** Términos de un préstamo de dinero (todo como texto, tal como se escribe en el formulario). */
export interface Prestamo {
  frecuencia: Frecuencia;
  cuota: string;
  nro_cuotas: string;
  fecha_inicio: string;
  precio: string;
  inicial: string;
  /** capital e interés (solo administradores). Encendido por defecto: en un préstamo el capital es lo prestado. */
  usar_capital: boolean;
  capital: string;
  interes: string;
  /** GPS en soles por mes ("" = sin GPS); normalmente un préstamo no lleva GPS */
  gps: string;
}

export const prestamoVacio = (fecha1: string): Prestamo => ({
  frecuencia: "semanal",
  cuota: "",
  nro_cuotas: "",
  fecha_inicio: fecha1,
  precio: "",
  inicial: "",
  usar_capital: true,
  capital: "",
  interes: "",
  gps: "",
});

/** Errores por campo del préstamo (vacío = todo bien). */
export function validarPrestamo(v: Prestamo): Record<string, string> {
  const e: Record<string, string> = {};
  const nro = Number(v.nro_cuotas);
  if (!(Number(v.cuota) > 0)) e.cuota = "Escribe la cuota.";
  if (!Number.isInteger(nro) || nro < 1 || nro > 1000) e.nro_cuotas = "Entre 1 y 1000 cuotas.";
  if (!v.fecha_inicio) e.fecha_inicio = "Elige la fecha de la 1.ª cuota.";
  if (!v.usar_capital) return e;
  if (!(Number(v.capital) > 0)) e.capital = "Escribe el capital prestado.";
  if (v.gps.trim() && !(Number(v.gps) >= 0)) e.gps = "Escribe un monto válido.";
  if (v.capital.trim() && !v.interes.trim()) e.interes = "Escribe el interés (puede ser 0).";
  else if (v.interes.trim() && interesEnPorcentaje(v.capital) && !(Number(v.interes) >= 0 && Number(v.interes) <= 500)) e.interes = "Entre 0 % y 500 %.";
  else if (v.interes.trim() && !(Number(v.interes) >= 0)) e.interes = "Escribe un monto válido.";
  return e;
}
