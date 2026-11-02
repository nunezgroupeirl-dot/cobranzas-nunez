"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useConEmpresa } from "@/components/layout/empresa";
import { Aviso, BotonEnlace, Cargando, Placa, nombreDocumento, Tarjeta, TituloPagina, useCarga } from "@/components/ui";
import { HistorialPagos } from "../../pagos/_componentes/HistorialPagos";
import { EliminarCliente } from "../_componentes/EliminarCliente";
import { TarjetaCronograma, TarjetaDatos, TarjetaSituacion } from "../_componentes/FichaTarjetas";

export default function FichaCliente() {
  const id = useSearchParams().get("id") ?? "";
  const { datos } = useSesion();
  const conEmpresa = useConEmpresa();
  const [contratoSel, setContratoSel] = useState<string | null>(null);

  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const [cliente, documentos, estados, contratos, motos, cuentas] = await Promise.all([
      datos.cliente(id),
      datos.documentos(id),
      datos.estadoClientes(),
      datos.contratos(),
      datos.motos(),
      datos.cuentas(),
    ]);
    const susContratos = contratos.filter((c) => c.cliente_id === id).sort((a, b) => b.creado_en.localeCompare(a.creado_en));
    const susMotos = new Set(susContratos.map((c) => c.moto_id));
    const pagos = (await Promise.all(susContratos.map((c) => datos.pagos({ contrato_id: c.id })))).flat();
    return {
      cliente,
      documentos,
      estados: estados.filter((e) => e.cliente_id === id),
      contratos: susContratos,
      // solo las motos de este cliente, indexadas por id
      motos: new Map(motos.filter((m) => susMotos.has(m.id)).map((m) => [m.id, m])),
      cuentas,
      pagos: pagos.sort((a, b) => b.fecha_pago.localeCompare(a.fecha_pago) || b.creado_en.localeCompare(a.creado_en)),
    };
  }, [datos, id]);

  const contratoActivo = contratoSel ?? info?.estados[0]?.contrato_id ?? info?.contratos[0]?.id ?? null;
  const { datos: cuotas } = useCarga(async () => (contratoActivo ? datos.cuotas(contratoActivo) : []), [datos, contratoActivo, info]);

  const resumen = useMemo(() => {
    if (!info) return null;
    return {
      estado: info.estados.find((e) => e.contrato_id === contratoActivo) ?? info.estados[0],
      deudaTotal: info.estados.reduce((s, e) => s + e.deuda, 0),
      pagosVigentes: info.pagos.filter((p) => !p.anulado).length,
    };
  }, [info, contratoActivo]);

  if (cargando && !info) return <Cargando />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!info?.cliente || !resumen) return <Aviso tipo="error">No se encontró el cliente.</Aviso>;

  const { cliente, documentos, contratos, motos, cuentas, pagos } = info;
  const { estado, deudaTotal, pagosVigentes } = resumen;

  return (
    <>
      <Link href={conEmpresa("/clientes")} className="mb-2 inline-block font-semibold text-marca">
        ← Clientes
      </Link>
      <TituloPagina
        titulo={cliente.nombres}
        sub={
          <span className="flex flex-wrap items-center gap-3">
            {estado && <Placa placa={estado.placa} tamano="grande" />}
            <span className="num">
              {nombreDocumento(cliente.dni)} {cliente.dni}
            </span>
          </span>
        }
        accion={
          <>
            <EliminarCliente cliente={cliente} contratos={contratos.length} pagos={pagos.length} />
            <BotonEnlace href={`/clientes/editar?id=${cliente.id}`} variante="secundario">
              Editar
            </BotonEnlace>
            <BotonEnlace href={estado ? `/pagos/nuevo?contrato=${estado.contrato_id}` : `/contratos/nuevo?cliente=${cliente.id}`} tamano="grande">
              {estado ? "Registrar pago" : "Crear contrato"}
            </BotonEnlace>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <TarjetaSituacion estado={estado} deudaTotal={deudaTotal} />
        <TarjetaDatos cliente={cliente} documentos={documentos} />
      </div>

      {contratos.length > 0 && (
        <TarjetaCronograma
          cliente={cliente}
          empresa={estado?.empresa ?? ""}
          contratos={contratos}
          motos={motos}
          contratoActivo={contratoActivo}
          alElegir={setContratoSel}
          cuotas={cuotas}
        />
      )}

      <Tarjeta className="mt-4" titulo={`Historial de pagos (${pagosVigentes})`}>
        <HistorialPagos pagos={pagos} cuentas={cuentas} alCambiar={recargar} />
      </Tarjeta>

    </>
  );
}
