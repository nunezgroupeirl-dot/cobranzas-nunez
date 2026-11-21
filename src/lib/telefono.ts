/**
 * Celulares. El principal es de Perú (9 números que empiezan con 9). El segundo puede ser también
 * de otro país (Venezuela, Cuba, México…): se guarda con "+" y su código, por ejemplo +584121234567.
 */
export const CELULAR_2_VALIDO = /^(9\d{8}|\+[1-9]\d{7,14})$/;

/** Lo que escriben en "Celular 2": solo números y un "+" al inicio ("00" al inicio cuenta como "+"; +51 9… queda como número peruano). */
export function limpiarCelular2(texto: string): string {
  let t = texto.trim().replace(/^00/, "+");
  const mas = t.startsWith("+");
  t = t.replace(/\D/g, "");
  if (mas && /^519\d{8}$/.test(t)) return t.slice(2);
  return mas ? `+${t}` : t;
}

/** Número para el enlace de WhatsApp (wa.me): con su código de país, sin "+". */
export function numeroWhatsApp(celular: string): string {
  return celular.startsWith("+") ? celular.slice(1).replace(/\D/g, "") : `51${celular.replace(/\D/g, "").slice(-9)}`;
}
