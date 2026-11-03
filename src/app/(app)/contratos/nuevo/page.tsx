"use client";
import { useSearchParams } from "next/navigation";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Cargando, TituloPagina, hoyLima, sumarDias, useCarga } from "@/components/ui";
import { AsistenteContrato } from "./_componentes/AsistenteContrato";

/** Nuevo contrato: se llena la plantilla del contrato paso a paso (cliente, moto, cuotas) y sale lista para firmar. */
function NuevoContrato() {
  const { datos } = useSesion();
  const clienteId = useSearchParams().get("cliente");
  const { datos: info, cargando, error } = useCarga(async () => {
    const [clientes, motos, contratos, cuentas] = await Promise.all([datos.clientes(), datos.motos(), datos.contratos(), datos.cuentas()]);
    return { clientes, motos, contratos, cuentas };
  }, [datos]);

  if (cargando && !info) return <Cargando />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!info) return null;
  const hoy = hoyLima();
  return (
    <>
      <TituloPagina titulo="Nuevo contrato" sub="Llena el contrato paso a paso. Al final se crea con su cronograma y sale listo para imprimir: solo faltan las firmas y las huellas." />
      <AsistenteContrato
        {...info}
        hoy={hoy}
        primeraCuota={sumarDias(hoy, 7)}
        clienteInicial={info.clientes.find((c) => c.id === clienteId) ?? null}
      />
    </>
  );
}

export default function PaginaNuevoContrato() {
  return (
    <SoloAdmin>
      <NuevoContrato />
    </SoloAdmin>
  );
}
