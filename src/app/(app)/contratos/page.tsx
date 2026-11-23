"use client";
import { ModalArchivar } from "../archivados/_componentes/ModalArchivar";
import { vigentes } from "@/lib/placa";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useConEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, BotonEnlace, Cargando, Modal, mensajeDeError, Tabla, TituloPagina, formatoFecha, formatoSoles, useCarga, type Columna, NOMBRE_ESTADO_CONTRATO, Placa, IconoVehiculo } from "@/components/ui";
import type { Contrato, Moto } from "@/types/database";
import { claveBusqueda, coincide, normalizar } from "../clientes/_componentes/buscar";
import { BotonPlantillaContrato } from "./_componentes/BotonPlantillaContrato";
import { FormMoto } from "./_componentes/FormMoto";

type Pestana = "contratos" | "motos";

export default function PaginaContratos() {
  const { datos, esAdmin } = useSesion();
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();
  const empresa = useEmpresa();
  const conEmpresa = useConEmpresa();
  const [pestana, setPestana] = useState<Pestana>("contratos");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<Moto | "nueva" | null>(null);
  const [archivando, setArchivando] = useState<Moto | null>(null);

  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const [contratos, motos, clientes, empresas, documentos] = await Promise.all([datos.contratos(), datos.motos(), datos.clientes(), datos.empresas(), datos.resumenDocumentos()]);
    return { contratos, motos, clientes, empresas, documentos };
  }, [datos]);

  // búsquedas por id en O(1): con cientos de contratos, .find dentro de cada fila se vuelve lento
  const mapas = useMemo(() => {
    const clientes = new Map((info?.clientes ?? []).map((c) => [c.id, c.nombres]));
    const placas = new Map((info?.motos ?? []).map((m) => [m.id, m.placa]));
    const cliente = (id: string | null) => (id ? clientes.get(id) : undefined);
    return {
      clientes,
      placas,
      motos: new Map((info?.motos ?? []).map((m) => [m.id, m])),
      empresas: new Map((info?.empresas ?? []).map((e) => [e.id, e.nombre])),
      // texto buscable de cada contrato y cada moto, calculado una sola vez
      claveContrato: new Map((info?.contratos ?? []).map((c) => [c.id, claveBusqueda(cliente(c.cliente_id), placas.get(c.moto_id))])),
      claveMoto: new Map((info?.motos ?? []).map((m) => [m.id, claveBusqueda(m.placa, cliente(m.cliente_id))])),
    };
  }, [info]);
  // Estado de cada contrato activo. Lo principal es si la hoja firmada está subida (el respaldo);
  // llenar y la foto del cliente con el contrato son secundarios. Misma lógica que Datos pendientes.
  const estadoContrato = useMemo(() => {
    const firmados = new Set<string>();
    const fotoCliente = new Set<string>();
    for (const d of info?.documentos ?? []) {
      if (d.tipo === "contrato" && d.contrato_id) firmados.add(d.contrato_id);
      else if (!d.moto_id && d.tipo === "cliente_contrato") fotoCliente.add(d.cliente_id);
    }
    const estado = new Map<string, { firmado: boolean; llenar: boolean; foto: boolean }>();
    for (const c of info?.contratos ?? []) {
      if (c.estado !== "activo") continue;
      estado.set(c.id, { firmado: firmados.has(c.id), llenar: !c.documento, foto: !fotoCliente.has(c.cliente_id) });
    }
    return estado;
  }, [info]);
  const nombreCliente = (id: string | null) => (id && mapas.clientes.get(id)) || "—";
  const nombreEmpresa = (id: string) => mapas.empresas.get(id) ?? "—";
  const q = normalizar(texto);

  const contratos = useMemo(
    () =>
      filtrarPorEmpresa(info?.contratos ?? [], empresa)
        .filter((c) => coincide(mapas.claveContrato.get(c.id) ?? "", q))
        .sort((a, b) => b.creado_en.localeCompare(a.creado_en)),
    [info, mapas, empresa, q],
  );
  const motos = useMemo(
    () =>
      filtrarPorEmpresa(vigentes(info?.motos ?? []), empresa)
        .filter((m) => coincide(mapas.claveMoto.get(m.id) ?? "", q))
        .sort((a, b) => (a.placa ?? "~").localeCompare(b.placa ?? "~")),
    [info, mapas, empresa, q],
  );

  const colContratos: Columna<Contrato>[] = [
    { clave: "cliente", titulo: "Cliente", celda: (c) => <span className="font-semibold">{nombreCliente(c.cliente_id)}</span> },
    {
      clave: "placa",
      titulo: "Vehículo",
      celda: (c) => (
        <span className="flex items-center gap-2">
          <IconoVehiculo tipo={mapas.motos.get(c.moto_id)?.tipo} />
          <Placa placa={mapas.motos.get(c.moto_id)?.placa} tramite={mapas.motos.get(c.moto_id)?.placa_tramite} tamano="chico" />
        </span>
      ),
    },
    { clave: "cuota", titulo: "Cuota", numero: true, celda: (c) => formatoSoles(c.monto_cuota) },
    { clave: "nro", titulo: "Cuotas", numero: true, celda: (c) => c.nro_cuotas },
    { clave: "inicio", titulo: "1.ª cuota", celda: (c) => formatoFecha(c.fecha_inicio) },
    { clave: "empresa", titulo: "Empresa", celda: (c) => nombreEmpresa(c.empresa_id), ocultarEnMovil: true },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (c) => {
        const s = c.estado === "activo" ? estadoContrato.get(c.id) : undefined;
        if (!s) return <span>{NOMBRE_ESTADO_CONTRATO[c.estado]}</span>;
        const chip = "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";
        return (
          <span className="flex flex-col items-start gap-1">
            {s.firmado ? (
              <span className={`${chip} bg-tinta/10 text-tinta`}>✓ Firmado</span>
            ) : (
              <span className={`${chip} bg-rojo-suave text-rojo`}>Falta firmar</span>
            )}
            {s.llenar && <span className={`${chip} bg-amarillo-suave text-amarillo`}>Falta llenar</span>}
            {s.foto && <span className={`${chip} bg-amarillo-suave text-amarillo`}>Falta foto</span>}
          </span>
        );
      },
    },
  ];
  const colMotos: Columna<Moto>[] = [
    { clave: "placa", titulo: "Placa", celda: (m) => <Placa placa={m.placa} tramite={m.placa_tramite} /> },
    { clave: "tipo", titulo: "Tipo", celda: (m) => <IconoVehiculo tipo={m.tipo} conTexto /> },
    { clave: "marca", titulo: "Marca", celda: (m) => m.marca },
    { clave: "color", titulo: "Color", celda: (m) => m.color },
    { clave: "cliente", titulo: "Cliente", celda: (m) => nombreCliente(m.cliente_id) },
    { clave: "empresa", titulo: "Empresa", celda: (m) => nombreEmpresa(m.empresa_id), ocultarEnMovil: true },
  ];

  return (
    <>
      <TituloPagina
        titulo="Vehículos y contratos"
        accion={
          <>
            <BotonPlantillaContrato tamano="grande" />
            <Boton variante="secundario" tamano="grande" onClick={() => setEditando("nueva")}>
              + Moto
            </Boton>
            <BotonEnlace href={conEmpresa("/contratos/nuevo")} tamano="grande">
              + Nuevo contrato
            </BotonEnlace>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex rounded-2xl border border-borde bg-superficie p-1" role="tablist">
          {(["contratos", "motos"] as Pestana[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={pestana === p}
              onClick={() => setPestana(p)}
              className={`min-h-11 flex-1 rounded-xl px-5 font-semibold ${pestana === p ? "bg-tinta text-white" : ""}`}
            >
              {p === "contratos" ? "Contratos" : "Vehículos"} {info && `(${p === "contratos" ? contratos.length : motos.length})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por cliente o placa"
          className="min-h-12 flex-1 rounded-2xl border border-borde bg-superficie px-4 focus:border-marca focus:outline-none"
          aria-label="Buscar"
        />
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && (
        <div className="mb-3">
          <Aviso tipo="error">{aviso}</Aviso>
        </div>
      )}
      {cargando && !info ? (
        <Cargando />
      ) : pestana === "contratos" ? (
        <Tabla columnas={colContratos} filas={contratos} claveFila={(c) => c.id} alTocar={(c) => router.push(conEmpresa(`/contratos/ver?id=${c.id}`))} vacio="No hay contratos." />
      ) : (
        <Tabla columnas={colMotos} filas={motos} claveFila={(m) => m.id} alTocar={(m) => setEditando(m)} vacio="No hay vehículos." />
      )}

      <Modal abierto={editando !== null} titulo={editando === "nueva" ? "Registrar vehículo" : "Editar vehículo"} alCerrar={() => setEditando(null)}>
        {editando !== null && (
          <FormMoto
            moto={editando === "nueva" ? undefined : editando}
            alCancelar={() => setEditando(null)}
            alEliminar={
              esAdmin && editando !== "nueva"
                ? async () => {
                    const m = editando;
                    if (!confirm(`¿Eliminar el vehículo ${m.placa ?? "sin placa"}? Solo se puede si no tiene contratos.`)) return;
                    setEditando(null);
                    try {
                      await datos.eliminarMoto(m.id);
                      setAviso(null);
                      recargar();
                    } catch (e) {
                      setAviso(mensajeDeError(e));
                    }
                  }
                : undefined
            }
            alArchivar={
              esAdmin && editando !== "nueva"
                ? () => {
                    setArchivando(editando);
                    setEditando(null);
                  }
                : undefined
            }
            alGuardar={() => {
              setEditando(null);
              recargar();
            }}
          />
        )}
      </Modal>
      {archivando && (
        <ModalArchivar
          tipo="moto"
          id={archivando.id}
          nombre={`El vehículo ${archivando.placa ?? "sin placa"}`}
          alCerrar={() => setArchivando(null)}
          alTerminar={() => {
            setArchivando(null);
            recargar();
          }}
        />
      )}
    </>
  );
}
