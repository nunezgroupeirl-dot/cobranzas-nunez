"use client";
import { useSearchParams } from "next/navigation";
import { useSesion } from "@/components/layout/Sesion";
import { Aviso, Cargando, TituloPagina, useCarga } from "@/components/ui";
import { FormCliente } from "../_componentes/FormCliente";

export default function EditarCliente() {
  const id = useSearchParams().get("id") ?? "";
  const { datos } = useSesion();
  const { datos: cliente, cargando, error } = useCarga(() => datos.cliente(id), [datos, id]);

  if (cargando) return <Cargando />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!cliente) return <Aviso tipo="error">No se encontró el cliente.</Aviso>;
  return (
    <>
      <TituloPagina titulo="Editar cliente" sub={cliente.nombres} />
      <FormCliente cliente={cliente} />
    </>
  );
}
