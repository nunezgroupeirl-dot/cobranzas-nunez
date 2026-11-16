"use client";
import { useSearchParams } from "next/navigation";
import { useSesion } from "@/components/layout/Sesion";
import { Aviso, Cargando, TituloPagina, useCarga } from "@/components/ui";
import { FormCliente } from "../_componentes/FormCliente";
import { cargarVentaActual } from "../_componentes/venta";

export default function EditarCliente() {
  const id = useSearchParams().get("id") ?? "";
  const { datos } = useSesion();
  // el cliente, con su moto y su contrato para editarlos en el mismo formulario
  const { datos: info, cargando, error } = useCarga(async () => {
    const [cliente, actual] = await Promise.all([datos.cliente(id), cargarVentaActual(datos, id)]);
    return { cliente, actual };
  }, [datos, id]);
  const cliente = info?.cliente;

  if (cargando) return <Cargando />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!cliente) return <Aviso tipo="error">No se encontró el cliente.</Aviso>;
  return (
    <>
      <TituloPagina titulo="Editar cliente" sub={cliente.nombres} />
      <FormCliente cliente={cliente} actual={info?.actual} />
    </>
  );
}
