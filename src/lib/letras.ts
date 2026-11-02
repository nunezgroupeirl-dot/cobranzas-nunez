/** Números y fechas en palabras, como se escriben en los contratos. */

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ_A_VEINTINUEVE = [
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function hasta99(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 30) return DIEZ_A_VEINTINUEVE[n - 10];
  const u = n % 10;
  return DECENAS[Math.floor(n / 10)] + (u ? ` y ${UNIDADES[u]}` : "");
}

function hasta999(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  return [CENTENAS[c], r ? hasta99(r) : ""].filter(Boolean).join(" ");
}

/** Entero en palabras (hasta 999 999 999). "uno" se apocopa delante de "mil" y "millones". */
export function enteroEnLetras(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${hasta999(millones).replace(/uno$/, "un")} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${hasta999(miles).replace(/uno$/, "un")} mil`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(" ");
}

/** 57.8 → "cincuenta y siete con 80/100 soles" */
export function solesEnLetras(monto: number): string {
  const centimos = Math.round(monto * 100);
  const entero = Math.floor(centimos / 100);
  return `${enteroEnLetras(entero)} con ${String(centimos % 100).padStart(2, "0")}/100 soles`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-09-16" → "16 de septiembre del 2026" */
export function fechaEnLetras(f: string): string {
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} del ${a}`;
}

/** Suma meses a una fecha YYYY-MM-DD (el 31 de enero + 1 mes queda en el último día de febrero). */
export function sumarMeses(f: string, meses: number): string {
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  const total = m - 1 + meses;
  const anio = a + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}
