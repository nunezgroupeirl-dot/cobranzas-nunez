"use client";
import { vigentes } from "@/lib/placa";
import { useSearchParams } from "next/navigation";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Cargando, TituloPagina, fechaLima, sumarDias, useCarga } from "@/components/ui";
import { AsistenteContrato } from "./_componentes/AsistenteContrato";

/** Nuevo contrato: se llena la plantilla del contrato paso a paso (cliente, moto, cuotas) y sale lista para firmar. */
function NuevoContrato() {
  const { datos } = useSesion();
  const clienteId = useSearchParams().get("cliente");
  const { datos: info, cargando, error } = useCarga(async () => {
    const [clientes, motos, contratos, cuentas] = await Promise.all([datos.clientes(), datos.motos(), datos.contratos(), datos.cuentas()]);
    return { clientes: vigentes(clientes), motos: vigentes(motos), contratos, cuentas };
  }, [datos]);

  if (cargando && !info) return <Cargando variante="formulario" />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!info) return null;
  const hoy = fechaLima();
  return (
    <>
      <TituloPagina
        titulo={clienteId ? "Paso 2 de 2: vehículo, placa y contrato" : "Nuevo contrato"}
        sub="Llena el contrato paso a paso: vehículo y placa, cuotas y fechas. Al final se crea con su cronograma de pagos y sale listo para imprimir; aparte solo queda subir el contrato firmado."
      />
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
