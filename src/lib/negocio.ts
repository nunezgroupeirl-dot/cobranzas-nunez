/** El dueño: firma los contratos como representante cuando la empresa no tiene otro registrado. */
export const DUENO_REPRESENTANTE = { nombre: "ANDRES ALEXANDER NUÑEZ TORRES", dni: "48140469" } as const;

/**
 * Domicilio del local que sale en los contratos: no cambia, así nadie lo escribe a mano.
 * Yarhua está en el lote 16; las empresas de Andrés Núñez (Anne, Nuñez Group, Romi) en el lote 4.
 */
export const DOMICILIO_LOTE_4 = "MZ 6 LOTE 4 SECTOR SANTIAGO ANTÚNEZ DE MAYOLO, PAMPLONA ALTA, SAN JUAN DE MIRAFLORES - LIMA";
export const DOMICILIO_LOTE_16 = "MZ 6 LOTE 16 SECTOR SANTIAGO ANTÚNEZ DE MAYOLO, PAMPLONA ALTA, SAN JUAN DE MIRAFLORES - LIMA";

export function domicilioDeEmpresa(nombreEmpresa: string | null | undefined): string {
  const n = (nombreEmpresa ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  return n.includes("YARHUA") ? DOMICILIO_LOTE_16 : DOMICILIO_LOTE_4;
}
