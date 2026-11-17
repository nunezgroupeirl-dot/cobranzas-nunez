import type { TipoDocumento } from "@/types/database";

export type TipoFoto = Exclude<TipoDocumento, "contrato">;

/**
 * Las fotos del cliente agrupadas por partes (así la ficha no se ve llena): cada grupo muestra
 * miniaturas chicas que se amplían al tocarlas. Las hojas del contrato se suben en su pantalla.
 */
export const GRUPOS_FOTOS: { titulo: string; ayuda: string; espacios: { tipo: TipoFoto; etiqueta: string }[] }[] = [
  {
    titulo: "Cliente",
    ayuda: "Rostro de frente y el documento por las 2 caras (que se lea el número). Foto o PDF.",
    espacios: [
      { tipo: "cliente", etiqueta: "Rostro" },
      { tipo: "dni", etiqueta: "Documento (frente)" },
      { tipo: "dni_reverso", etiqueta: "Documento (reverso)" },
    ],
  },
  { titulo: "Vehículo", ayuda: "Con la placa visible.", espacios: [{ tipo: "moto", etiqueta: "Vehículo" }] },
  {
    titulo: "Casa",
    ayuda: "Frente de la casa y recibo de luz o agua con la dirección.",
    espacios: [
      { tipo: "fachada", etiqueta: "Fachada" },
      { tipo: "recibo", etiqueta: "Recibo" },
    ],
  },
  { titulo: "Otros", ayuda: "Cualquier otro documento. Foto o PDF.", espacios: [{ tipo: "otro", etiqueta: "Otro" }] },
];

export const TOTAL_FOTOS = GRUPOS_FOTOS.reduce((n, g) => n + g.espacios.length, 0);
