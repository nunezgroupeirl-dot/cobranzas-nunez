"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { camposDesdeSistema, camposGuardados } from "@/components/reportes/ContratoImpreso";
import { Aviso, Cargando, TituloPagina, fechaLima, useCarga } from "@/components/ui";
import { FormularioContrato } from "./_componentes/FormularioContrato";

/** Llenado guiado del contrato de alquiler venta: se completa aquí y el PDF sale listo para firmar. */
function DocumentoContrato() {
  const id = useSearchParams().get("id") ?? "";
  const { datos, empresas } = useSesion();

  const { datos: info, cargando, error } = useCarga(async () => {
    const contrato = await datos.contrato(id);
    if (!contrato) return null;
    const [cliente, motos, cuentas] = await Promise.all([datos.cliente(contrato.cliente_id), datos.motos(), datos.cuentas()]);
    const moto = motos.find((m) => m.id === contrato.moto_id) ?? null;
    const empresa = empresas.find((e) => e.id === contrato.empresa_id) ?? null;
    if (!cliente || !moto || !empresa) return null;
    const base = camposDesdeSistema(empresa, cliente, moto, contrato, cuentas, fechaLima());
    return {
      contrato,
      cliente,
      moto,
      empresa,
      iniciales: camposGuardados(base, contrato.documento),
      // contrato con varios vehículos: los demás salen en el contrato con sus datos
      extras: motos.filter((m) => m.contrato_id === contrato.id && m.id !== contrato.moto_id).sort((a, b) => (a.creado_en ?? "").localeCompare(b.creado_en ?? "")),
      cuentas: cuentas.filter((c) => c.empresa_id === empresa.id || !c.empresa_id).map((c) => c.nombre), // las de la empresa y los Yape/Plin personales
    };
  }, [datos, id, empresas]);

  if (cargando) return <Cargando variante="formulario" />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!info) return <Aviso tipo="error">No se encontró el contrato.</Aviso>;

  return (
    <>
      <Link href={`/contratos/ver?id=${info.contrato.id}`} className="mb-2 inline-block font-semibold text-marca">
        ← Volver al contrato
      </Link>
      <TituloPagina
        titulo="Llenar contrato"
        sub={`${info.cliente.nombres} · ${info.moto.placa ?? (info.moto.placa_tramite ? "placa en trámite" : "sin placa")}. Paso a paso, todos los datos del contrato: en el papel solo quedan las firmas y las huellas.`}
      />
      <FormularioContrato key={info.contrato.id} {...info} />
    </>
  );
}

export default function PaginaDocumentoContrato() {
  return (
    <SoloAdmin>
      <DocumentoContrato />
    </SoloAdmin>
  );
}
