"use client";
import { TituloPagina } from "@/components/ui";
import { FormCliente } from "../_componentes/FormCliente";

export default function NuevoCliente() {
  return (
    <>
      <TituloPagina titulo="Nuevo cliente" sub="Datos y fotos del cliente, sus vehículos (placa) y su cronograma de pagos. El contrato en papel se puede llenar ahora o después." />
      <FormCliente />
    </>
  );
}
