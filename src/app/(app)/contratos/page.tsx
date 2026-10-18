"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useConEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, BotonEnlace, Cargando, Modal, Tabla, TituloPagina, formatoFecha, formatoSoles, useCarga, type Columna, NOMBRE_ESTADO_CONTRATO } from "@/components/ui";
import type { Contrato, Moto } from "@/types/database";
import { claveBusqueda, coincide, normalizar } from "../clientes/_componentes/buscar";
import { FormMoto } from "./_componentes/FormMoto";

type Pestana = "contratos" | "motos";

export default function PaginaContratos() {
  const { datos } = useSesion();
  const router = useRouter();
  const empresa = useEmpresa();
  const conEmpresa = useConEmpresa();
  const [pestana, setPestana] = useState<Pestana>("contratos");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<Moto | "nueva" | null>(null);

  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const [contratos, motos, clientes, empresas] = await Promise.all([datos.contratos(), datos.motos(), datos.clientes(), datos.empresas()]);
    return { contratos, motos, clientes, empresas };
  }, [datos]);

  // búsquedas por id en O(1): con cientos de contratos, .find dentro de cada fila se vuelve lento
  const mapas = useMemo(() => {
    const clientes = new Map((info?.clientes ?? []).map((c) => [c.id, c.nombres]));
    const placas = new Map((info?.motos ?? []).map((m) => [m.id, m.placa]));
    const cliente = (id: string | null) => (id ? clientes.get(id) : undefined);
    return {
      clientes,
      placas,
      empresas: new Map((info?.empresas ?? []).map((e) => [e.id, e.nombre])),
      // texto buscable de cada contrato y cada moto, calculado una sola vez
      claveContrato: new Map((info?.contratos ?? []).map((c) => [c.id, claveBusqueda(cliente(c.cliente_id), placas.get(c.moto_id))])),
      claveMoto: new Map((info?.motos ?? []).map((m) => [m.id, claveBusqueda(m.placa, cliente(m.cliente_id))])),
    };
  }, [info]);
  const nombreCliente = (id: string | null) => (id && mapas.clientes.get(id)) || "—";
  const placa = (id: string) => mapas.placas.get(id) ?? "—";
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
      filtrarPorEmpresa(info?.motos ?? [], empresa)
        .filter((m) => coincide(mapas.claveMoto.get(m.id) ?? "", q))
        .sort((a, b) => a.placa.localeCompare(b.placa)),
    [info, mapas, empresa, q],
  );

  const colContratos: Columna<Contrato>[] = [
    { clave: "cliente", titulo: "Cliente", celda: (c) => <span className="font-semibold">{nombreCliente(c.cliente_id)}</span> },
    { clave: "placa", titulo: "Placa", celda: (c) => <span className="font-mono font-semibold">{placa(c.moto_id)}</span> },
    { clave: "cuota", titulo: "Cuota", numero: true, celda: (c) => formatoSoles(c.monto_cuota) },
    { clave: "nro", titulo: "Cuotas", numero: true, celda: (c) => c.nro_cuotas },
    { clave: "inicio", titulo: "1.ª cuota", celda: (c) => formatoFecha(c.fecha_inicio) },
    { clave: "empresa", titulo: "Empresa", celda: (c) => nombreEmpresa(c.empresa_id), ocultarEnMovil: true },
    { clave: "estado", titulo: "Estado", celda: (c) => <span>{NOMBRE_ESTADO_CONTRATO[c.estado]}</span> },
  ];
  const colMotos: Columna<Moto>[] = [
    { clave: "placa", titulo: "Placa", celda: (m) => <span className="font-mono text-lg font-bold whitespace-nowrap">{m.placa}</span> },
    { clave: "tipo", titulo: "Tipo", celda: (m) => m.tipo },
    { clave: "marca", titulo: "Marca", celda: (m) => m.marca },
    { clave: "color", titulo: "Color", celda: (m) => m.color },
    { clave: "cliente", titulo: "Cliente", celda: (m) => nombreCliente(m.cliente_id) },
    { clave: "empresa", titulo: "Empresa", celda: (m) => nombreEmpresa(m.empresa_id), ocultarEnMovil: true },
  ];

  return (
    <>
      <TituloPagina
        titulo="Motos y contratos"
        accion={
          <>
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
              className={`min-h-11 flex-1 rounded-xl px-5 font-semibold capitalize ${pestana === p ? "bg-tinta text-white" : ""}`}
            >
              {p} {info && `(${p === "contratos" ? contratos.length : motos.length})`}
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
      {cargando && !info ? (
        <Cargando />
      ) : pestana === "contratos" ? (
        <Tabla columnas={colContratos} filas={contratos} claveFila={(c) => c.id} alTocar={(c) => router.push(conEmpresa(`/contratos/ver?id=${c.id}`))} vacio="No hay contratos." />
      ) : (
        <Tabla columnas={colMotos} filas={motos} claveFila={(m) => m.id} alTocar={(m) => setEditando(m)} vacio="No hay motos." />
      )}

      <Modal abierto={editando !== null} titulo={editando === "nueva" ? "Registrar moto" : "Editar moto"} alCerrar={() => setEditando(null)}>
        {editando !== null && (
          <FormMoto
            moto={editando === "nueva" ? undefined : editando}
            alCancelar={() => setEditando(null)}
            alGuardar={() => {
              setEditando(null);
              recargar();
            }}
          />
        )}
      </Modal>
    </>
  );
}
