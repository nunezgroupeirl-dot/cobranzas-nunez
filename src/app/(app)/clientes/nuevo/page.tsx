"use client";
import { TituloPagina } from "@/components/ui";
import { FormCliente } from "../_componentes/FormCliente";

export default function NuevoCliente() {
  return (
    <>
      <TituloPagina titulo="Nuevo cliente" sub="Paso 1 de 2: datos y fotos. Después registras su moto y contrato." />
      <FormCliente />
    </>
  );
}
