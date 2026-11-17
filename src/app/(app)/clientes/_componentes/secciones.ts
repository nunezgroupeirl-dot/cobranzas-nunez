import type { TipoDocumento } from "@/types/database";

export type TipoFoto = Exclude<TipoDocumento, "contrato">;

/**
 * Las fotos del cliente agrupadas por partes (así la ficha no se ve llena): cada grupo muestra
 * miniaturas chicas que se amplían al tocarlas. Las hojas del contrato se suben en su pantalla.
 */
export const GRUPOS_FOTOS: { titulo: string; ayuda: string; espacios: { tipo: TipoFoto; etiqueta: string }[] }[] = [
  {
    titulo: "Cliente",
    ayuda: "El cliente solo, el cliente con su contrato y el documento por las 2 caras (que se lea el número).",
    espacios: [
      { tipo: "cliente", etiqueta: "Cliente solo" },
      { tipo: "cliente_contrato", etiqueta: "Con el contrato" },
      { tipo: "dni", etiqueta: "Documento (frente)" },
      { tipo: "dni_reverso", etiqueta: "Documento (reverso)" },
    ],
  },
  {
    titulo: "Vehículo",
    ayuda: "Los 4 lados (de frente y de atrás, con la placa visible) y la tarjeta de propiedad por las 2 caras, si la traen. Foto o PDF.",
    espacios: [
      { tipo: "moto", etiqueta: "Frente" },
      { tipo: "moto_atras", etiqueta: "Atrás" },
      { tipo: "moto_izquierda", etiqueta: "Izquierda" },
      { tipo: "moto_derecha", etiqueta: "Derecha" },
      { tipo: "tarjeta_frente", etiqueta: "Tarjeta (frente)" },
      { tipo: "tarjeta_reverso", etiqueta: "Tarjeta (reverso)" },
    ],
  },
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
