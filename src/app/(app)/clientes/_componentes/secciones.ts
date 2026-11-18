import type { TipoDocumento } from "@/types/database";

export type TipoFoto = Exclude<TipoDocumento, "contrato">;

/** Un espacio de foto. "varios": se pueden subir varias (aparece "+ Agregar otro" al costado). */
export interface EspacioFoto {
  tipo: TipoFoto;
  etiqueta: string;
  varios?: boolean;
}

export interface GrupoFotos {
  titulo: string;
  ayuda: string;
  espacios: EspacioFoto[];
}

/**
 * Las fotos del cliente agrupadas por partes (así la ficha no se ve llena): cada grupo muestra
 * miniaturas chicas que se amplían al tocarlas. Las hojas del contrato se suben en su pantalla.
 */
export const GRUPOS_FOTOS: GrupoFotos[] = [
  {
    titulo: "Cliente",
    ayuda:
      "El cliente solo, el cliente con su contrato y el documento por las 2 caras (que se lea el número).",
    espacios: [
      { tipo: "cliente", etiqueta: "Cliente solo" },
      { tipo: "cliente_contrato", etiqueta: "Con el contrato" },
      { tipo: "dni", etiqueta: "Documento (frente)" },
      { tipo: "dni_reverso", etiqueta: "Documento (reverso)" },
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
  {
    titulo: "Otros",
    ayuda: "Cualquier otro documento. Foto o PDF; se pueden agregar varios.",
    espacios: [{ tipo: "otro", etiqueta: "Otro", varios: true }],
  },
];

/**
 * Las fotos de cada vehículo (un cliente puede tener varios): van dentro de cada vehículo del formulario
 * y en la ficha, en la pestaña de ese vehículo.
 */
export const GRUPO_VEHICULO: GrupoFotos = {
  titulo: "Vehículo",
  ayuda:
    "Los 4 lados (de frente y de atrás, con la placa visible) y la tarjeta de propiedad por las 2 caras, si la traen. Foto o PDF.",
  espacios: [
    { tipo: "moto", etiqueta: "Frente" },
    { tipo: "moto_atras", etiqueta: "Atrás" },
    { tipo: "moto_izquierda", etiqueta: "Izquierda" },
    { tipo: "moto_derecha", etiqueta: "Derecha" },
    { tipo: "tarjeta_frente", etiqueta: "Tarjeta (frente)" },
    { tipo: "tarjeta_reverso", etiqueta: "Tarjeta (reverso)" },
  ],
};

export const TIPOS_VEHICULO = new Set<string>(
  GRUPO_VEHICULO.espacios.map((e) => e.tipo),
);

/**
 * Clave de una foto aún no subida: el tipo, o "tipo:n" en los espacios que aceptan varias;
 * las del vehículo llevan delante la clave del vehículo del formulario: "nuevo-2|moto_atras".
 */
export const tipoDeClave = (clave: string) =>
  clave.split("|").pop()!.split(":")[0] as TipoFoto;
export const vehiculoDeClave = (clave: string): string | null =>
  clave.includes("|") ? clave.split("|")[0] : null;

/** Espacios de fotos del cliente (sin las del vehículo, que son por vehículo). */
export const TOTAL_FOTOS = GRUPOS_FOTOS.reduce(
  (n, g) => n + g.espacios.length,
  0,
);
