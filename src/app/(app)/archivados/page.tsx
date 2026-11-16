"use client";
import Link from "next/link";
import { useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { useConEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Cargando, IconoVehiculo, Placa, Tabla, Tarjeta, TituloPagina, formatoFechaHora, mensajeDeError, textoDocumento, useCarga, type Columna } from "@/components/ui";
import type { Cliente, Moto } from "@/types/database";

/** Clientes y vehículos que ya no están en la empresa: no salen en las listas, pero sus datos siguen aquí. */
function Archivados() {
  const { datos } = useSesion();
  const conEmpresa = useConEmpresa();
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { datos: info, cargando, error, recargar } = useCarga(async () => {
    const [clientes, motos] = await Promise.all([datos.clientes(), datos.motos()]);
    const nombre = new Map(clientes.map((c) => [c.id, c.nombres]));
    return {
      clientes: clientes.filter((c) => c.archivado),
      motos: motos.filter((m) => m.archivado).map((m) => ({ ...m, cliente: m.cliente_id ? nombre.get(m.cliente_id) : undefined })),
    };
  }, [datos]);

  const restaurar = async (tipo: "cliente" | "moto", id: string, nombre: string) => {
    if (!confirm(`¿Restaurar ${nombre}? Volverá a salir en las listas.`)) return;
    setOcupado(id);
    try {
      await datos.archivar(tipo, id, false);
      setAviso({ tipo: "exito", texto: `${nombre} restaurado.` });
      recargar();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeDeError(e) });
    } finally {
      setOcupado(null);
    }
  };

  const colClientes: Columna<Cliente>[] = [
    {
      clave: "nombre",
      titulo: "Cliente",
      celda: (c) => (
        <Link href={conEmpresa(`/clientes/ficha?id=${c.id}`)} className="font-semibold hover:text-marca hover:underline">
          {c.nombres}
        </Link>
      ),
    },
    { clave: "dni", titulo: "Documento", celda: (c) => textoDocumento(c.dni) },
    { clave: "fecha", titulo: "Archivado", celda: (c) => (c.archivado_en ? formatoFechaHora(c.archivado_en) : "—"), ocultarEnMovil: true },
    { clave: "motivo", titulo: "Motivo", celda: (c) => c.archivado_motivo ?? <span className="text-tenue">—</span> },
    {
      clave: "acciones",
      titulo: "",
      celda: (c) => (
        <Boton variante="secundario" tamano="chico" cargando={ocupado === c.id} onClick={() => restaurar("cliente", c.id, c.nombres)}>
          Restaurar
        </Boton>
      ),
    },
  ];
  const colMotos: Columna<Moto & { cliente?: string }>[] = [
    {
      clave: "placa",
      titulo: "Vehículo",
      celda: (m) => (
        <span className="flex items-center gap-2">
          <IconoVehiculo tipo={m.tipo} />
          <Placa placa={m.placa} tramite={m.placa_tramite} tamano="chico" />
          <span className="text-sm">{[m.marca, m.color].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    { clave: "cliente", titulo: "Último cliente", celda: (m) => m.cliente ?? <span className="text-tenue">—</span> },
    { clave: "fecha", titulo: "Archivado", celda: (m) => (m.archivado_en ? formatoFechaHora(m.archivado_en) : "—"), ocultarEnMovil: true },
    { clave: "motivo", titulo: "Motivo", celda: (m) => m.archivado_motivo ?? <span className="text-tenue">—</span> },
    {
      clave: "acciones",
      titulo: "",
      celda: (m) => (
        <Boton variante="secundario" tamano="chico" cargando={ocupado === m.id} onClick={() => restaurar("moto", m.id, m.placa ?? "el vehículo")}>
          Restaurar
        </Boton>
      ),
    },
  ];

  return (
    <>
      <TituloPagina
        titulo="Archivados"
        sub="Clientes y vehículos que ya no están en la empresa. No salen en las listas del día a día, pero sus datos, contratos, pagos y fotos se guardan. Su historia completa está en Histórico."
      />
      {aviso && (
        <div className="mb-3">
          <Aviso tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
            {aviso.texto}
          </Aviso>
        </div>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !info ? (
        <Cargando />
      ) : (
        <div className="flex flex-col gap-4">
          <Tarjeta titulo={`Clientes (${info?.clientes.length ?? 0})`}>
            <Tabla columnas={colClientes} filas={info?.clientes ?? []} claveFila={(c) => c.id} vacio="No hay clientes archivados. Se archivan desde la ficha del cliente." />
          </Tarjeta>
          <Tarjeta titulo={`Vehículos (${info?.motos.length ?? 0})`}>
            <Tabla columnas={colMotos} filas={info?.motos ?? []} claveFila={(m) => m.id} vacio="No hay vehículos archivados. Se archivan desde Vehículos y contratos." />
          </Tarjeta>
        </div>
      )}
    </>
  );
}

export default function PaginaArchivados() {
  return (
    <SoloAdmin>
      <Archivados />
    </SoloAdmin>
  );
}
