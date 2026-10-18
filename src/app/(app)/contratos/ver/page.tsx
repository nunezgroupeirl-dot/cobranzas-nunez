"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { BotonPdfCronograma } from "@/components/reportes/PdfCronograma";
import { Aviso, Boton, BotonEnlace, Cargando, Tarjeta, TituloPagina, useCarga } from "@/components/ui";
import { Cronograma } from "../_componentes/Cronograma";
import { ModalCerrarContrato } from "../_componentes/ModalCerrarContrato";
import { ResumenContrato } from "../_componentes/ResumenContrato";

export default function VerContrato() {
  const parametros = useSearchParams();
  const id = parametros.get("id") ?? "";
  const esNuevo = parametros.get("nuevo") === "1";
  const { datos, esAdmin } = useSesion();
  const [cerrando, setCerrando] = useState(false);

  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const contrato = await datos.contrato(id);
    if (!contrato) return null;
    const [cliente, motos, cuotas, estados, empresas] = await Promise.all([
      datos.cliente(contrato.cliente_id),
      datos.motos(),
      datos.cuotas(id),
      datos.estadoClientes(),
      datos.empresas(),
    ]);
    return {
      contrato,
      cliente,
      moto: motos.find((m) => m.id === contrato.moto_id) ?? null,
      cuotas,
      estado: estados.find((e) => e.contrato_id === id) ?? null,
      empresa: empresas.find((e) => e.id === contrato.empresa_id)?.nombre ?? "",
    };
  }, [datos, id]);

  if (cargando) return <Cargando />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!info) return <Aviso tipo="error">No se encontró el contrato.</Aviso>;
  const { contrato, cliente, moto, cuotas, estado, empresa } = info;
  const activo = contrato.estado === "activo";

  return (
    <>
      {cliente && (
        <Link href={`/clientes/ficha?id=${cliente.id}`} className="mb-2 inline-block font-semibold text-marca">
          ← {cliente.nombres}
        </Link>
      )}
      {esNuevo && (
        <div className="mb-4">
          <Aviso tipo="exito">Contrato creado con sus {contrato.nro_cuotas} cuotas.</Aviso>
        </div>
      )}
      <TituloPagina
        titulo={`Contrato · ${moto?.placa ?? ""}`}
        sub={`${cliente?.nombres ?? ""} · ${empresa}`}
        accion={
          <>
            {cliente && moto && (
              <BotonPdfCronograma cliente={cliente.nombres} dni={cliente.dni} placa={moto.placa} empresa={empresa} contrato={contrato} cuotas={cuotas} />
            )}
            {activo && esAdmin && (
              <Boton variante="secundario" tamano="grande" onClick={() => setCerrando(true)}>
                Cerrar contrato
              </Boton>
            )}
            {activo && (
              <BotonEnlace href={`/pagos/nuevo?contrato=${contrato.id}`} tamano="grande">
                Registrar pago
              </BotonEnlace>
            )}
          </>
        }
      />
      <ResumenContrato contrato={contrato} cuotas={cuotas} estado={estado} moto={moto} />
      <Tarjeta className="mt-4" titulo="Cronograma">
        <Cronograma cuotas={cuotas} />
      </Tarjeta>
      <ModalCerrarContrato
        contratoId={contrato.id}
        placa={moto?.placa}
        abierto={cerrando}
        alCerrar={() => setCerrando(false)}
        alTerminar={() => {
          setCerrando(false);
          recargar();
        }}
      />
    </>
  );
}
