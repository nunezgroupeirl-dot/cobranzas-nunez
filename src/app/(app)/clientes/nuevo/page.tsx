"use client";
import { TituloPagina } from "@/components/ui";
import { FormCliente } from "../_componentes/FormCliente";

export default function NuevoCliente() {
  return (
    <>
      <TituloPagina titulo="Nuevo cliente" sub="Paso 1 de 2: datos y fotos del cliente. En el paso 2 registras su moto (placa), el cronograma de pagos y el contrato." />
      <FormCliente />
    </>
  );
}
