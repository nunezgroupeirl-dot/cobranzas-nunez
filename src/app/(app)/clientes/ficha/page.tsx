"use client";
import type { Cliente, Moto } from "@/types/database";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useConEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, BotonEnlace, Cargando, IconoVehiculo, Placa, formatoFecha, mensajeDeError, textoDocumento, Tarjeta, TituloPagina, useCarga } from "@/components/ui";
import { ModalArchivar } from "../../archivados/_componentes/ModalArchivar";
import { HistorialPagos } from "../../pagos/_componentes/HistorialPagos";
import { EliminarCliente } from "../_componentes/EliminarCliente";
import { TarjetaCronograma, TarjetaDatos, TarjetaSituacion } from "../_componentes/FichaTarjetas";

export default function FichaCliente() {
  const id = useSearchParams().get("id") ?? "";
  const { datos, esAdmin } = useSesion();
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
      motoActiva: info.motos.get(info.contratos.find((c) => c.id === contratoActivo)?.moto_id ?? ""),
    };
  }, [info, contratoActivo]);

  if (cargando && !info) return <Cargando variante="ficha" />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!info?.cliente || !resumen) return <Aviso tipo="error">No se encontró el cliente.</Aviso>;

  const { cliente, documentos, contratos, motos, cuentas, pagos } = info;
  const { estado, deudaTotal, pagosVigentes, motoActiva } = resumen;

  return (
    <>
      <Link href={conEmpresa("/clientes")} className="mb-2 inline-block font-semibold text-marca">
        ← Clientes
      </Link>
      <TituloPagina
        titulo={cliente.nombres}
        sub={
          <span className="flex flex-wrap items-center gap-3">
            <VehiculoCliente moto={motoActiva} placa={estado?.placa} />
            <DocumentoCliente dni={cliente.dni} />
          </span>
        }
        accion={
          <>
            {esAdmin && <ArchivarCliente cliente={cliente} alCambiar={recargar} />}
            <EliminarCliente cliente={cliente} contratos={contratos.length} pagos={pagos.length} />
            {esAdmin && (
              <BotonEnlace href={`/clientes/editar?id=${cliente.id}`} variante="secundario">
                Editar
              </BotonEnlace>
            )}
            <AccionPrincipal clienteId={cliente.id} contratoId={estado?.contrato_id} esAdmin={esAdmin} />
          </>
        }
      />

      <AvisoArchivado cliente={cliente} />
      <div className="grid gap-4 lg:grid-cols-3">
        <TarjetaSituacion estado={estado} deudaTotal={deudaTotal} />
        <TarjetaDatos cliente={cliente} documentos={documentos} />
      </div>

      {contratos.length === 0 && esAdmin && <FaltaContrato clienteId={cliente.id} />}
      {contratos.length > 0 && (
        <TarjetaCronograma
          cliente={cliente}
          empresa={estado?.empresa}
          contratos={contratos}
          motos={motos}
          contratoActivo={contratoActivo}
          alElegir={setContratoSel}
          cuotas={cuotas}
          soloLectura={!esAdmin}
          alCambiar={recargar}
        />
      )}

      <Tarjeta className="mt-4" titulo={`Historial de pagos (${pagosVigentes})`}>
        <HistorialPagos pagos={pagos} cuentas={cuentas} alCambiar={recargar} />
      </Tarjeta>

    </>
  );
}

function DocumentoCliente({ dni }: { dni: string | null }) {
  return <span className={dni ? "num" : "font-semibold text-amarillo"}>{textoDocumento(dni)}</span>;
}

/** Con contrato activo: registrar pago (todos). Sin contrato: crear uno (solo el dueño). */
function AccionPrincipal({ clienteId, contratoId, esAdmin }: { clienteId: string; contratoId?: string; esAdmin: boolean }) {
  if (contratoId)
    return (
      <BotonEnlace href={`/pagos/nuevo?contrato=${contratoId}`} tamano="grande">
        Registrar pago
      </BotonEnlace>
    );
  if (!esAdmin) return null;
  return (
    <BotonEnlace href={`/contratos/nuevo?cliente=${clienteId}`} tamano="grande">
      Crear contrato
    </BotonEnlace>
  );
}

/** El vehículo que el cliente tiene en su poder: ícono, tipo y placa (o "en trámite"). */
function VehiculoCliente({ moto, placa }: { moto?: Moto; placa?: string | null }) {
  if (!moto) return placa ? <Placa placa={placa} tamano="grande" /> : null;
  return (
    <>
      <IconoVehiculo tipo={moto.tipo} className="h-8 w-11" conTexto />
      <Placa placa={moto.placa} tramite={moto.placa_tramite} tamano="grande" />
    </>
  );
}

/** Cliente registrado sin contrato: lleva al paso 2 (moto, placa, cronograma y contrato). */
function FaltaContrato({ clienteId }: { clienteId: string }) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border-2 border-amarillo bg-amarillo-suave p-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-bold">Falta el paso 2: vehículo, placa y cronograma</p>
        <p className="text-sm">Este cliente aún no tiene vehículo ni cronograma de pagos. Regístralos con el contrato: sale listo para imprimir y firmar.</p>
      </div>
      <BotonEnlace href={`/contratos/nuevo?cliente=${clienteId}`}>Registrar vehículo y contrato →</BotonEnlace>
    </div>
  );
}

/** Botón "Archivar" (el cliente ya no está en la empresa). Si ya está archivado, "Restaurar". */
function ArchivarCliente({ cliente, alCambiar }: { cliente: Cliente; alCambiar: () => void }) {
  const { datos } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (cliente.archivado)
    return (
      <Boton
        variante="secundario"
        onClick={async () => {
          try {
            await datos.archivar("cliente", cliente.id, false);
            alCambiar();
          } catch (e) {
            setError(mensajeDeError(e));
          }
        }}
      >
        {error ?? "Restaurar"}
      </Boton>
    );
  return (
    <>
      <Boton variante="fantasma" onClick={() => setAbierto(true)}>
        Archivar
      </Boton>
      {abierto && (
        <ModalArchivar
          tipo="cliente"
          id={cliente.id}
          nombre={cliente.nombres}
          alCerrar={() => setAbierto(false)}
          alTerminar={() => {
            setAbierto(false);
            alCambiar();
          }}
        />
      )}
    </>
  );
}

function AvisoArchivado({ cliente }: { cliente: Cliente }) {
  if (!cliente.archivado) return null;
  const cuando = cliente.archivado_en ? ` el ${formatoFecha(cliente.archivado_en.slice(0, 10))}` : "";
  return (
    <div className="mb-4">
      <Aviso tipo="alerta">
        Cliente archivado{cuando}
        {cliente.archivado_motivo ? ` · ${cliente.archivado_motivo}` : ""}. No sale en las listas; se restaura desde Archivados.
      </Aviso>
    </div>
  );
}
