import { NOMBRE_DOCUMENTO } from "@/components/ui/formato";
import type { TipoDocumento } from "@/types/database";

export type TipoFoto = Exclude<TipoDocumento, "contrato">;

/** Cada sección agrupa uno o más espacios (el DNI lleva frente y reverso). Las hojas del contrato se suben en su pantalla. */
export const SECCIONES: { titulo: string; ayuda: string; espacios: { tipo: TipoFoto; etiqueta?: string }[] }[] = [
  { titulo: NOMBRE_DOCUMENTO.cliente, ayuda: "Rostro, de frente", espacios: [{ tipo: "cliente" }] },
  {
    titulo: "DNI o Carné de Extranjería",
    ayuda: "Las 2 caras, que se lea el número. Foto o PDF.",
    espacios: [
      { tipo: "dni", etiqueta: "Frente" },
      { tipo: "dni_reverso", etiqueta: "Reverso" },
    ],
  },
  { titulo: NOMBRE_DOCUMENTO.moto, ayuda: "Con la placa visible", espacios: [{ tipo: "moto" }] },
  { titulo: NOMBRE_DOCUMENTO.fachada, ayuda: "Frente de la casa", espacios: [{ tipo: "fachada" }] },
  { titulo: NOMBRE_DOCUMENTO.recibo, ayuda: "Luz o agua, con la dirección. Foto o PDF.", espacios: [{ tipo: "recibo" }] },
  { titulo: NOMBRE_DOCUMENTO.otro, ayuda: "Cualquier otro documento. Foto o PDF.", espacios: [{ tipo: "otro" }] },
];

export const TOTAL_FOTOS = SECCIONES.reduce((n, s) => n + s.espacios.length, 0);
