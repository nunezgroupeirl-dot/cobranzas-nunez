"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { filtrarPorEmpresa, useConEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, Boton, Cargando, IconoVehiculo, NOMBRE_ESTADO_CONTRATO, Placa, TituloPagina, formatoFecha, formatoSoles, nombreCuota, useCarga } from "@/components/ui";
import { fechaCuota } from "@/lib/supabase/reglas";
import { claveBusqueda, coincide, normalizar } from "@/lib/texto";
import type { Cliente, Contrato, Moto } from "@/types/database";

type EstadoContrato = Contrato["estado"];

const POR_PAGINA = 30;
const FILTROS: { valor: EstadoContrato | ""; texto: string }[] = [
  { valor: "", texto: "Todos" },
  { valor: "activo", texto: "Pagando" },
  { valor: "terminado", texto: "Terminados" },
  { valor: "anulado", texto: "Cerrados" },
];
const COLOR_ESTADO: Record<EstadoContrato, string> = {
  activo: "bg-verde-suave text-verde",
  terminado: "bg-marca-suave text-marca-oscura",
  anulado: "bg-rojo-suave text-rojo",
};

interface Ficha {
  moto: Moto;
  contratos: (Contrato & { cliente?: Cliente })[];
  clave: string;
  ultimo: string;
}

/**
 * Histórico: cada vehículo con todos sus contratos (activos, terminados o cerrados) y quién lo tuvo.
 * Incluye clientes y vehículos archivados: aunque ya no estén en la empresa, su historia queda.
 */
function Historico() {
  const { datos } = useSesion();
  const empresa = useEmpresa();
  const conEmpresa = useConEmpresa();
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<EstadoContrato | "">("");
  const [cuantos, setCuantos] = useState(POR_PAGINA);

  const { datos: fichas, cargando, error } = useCarga(async () => {
    const [contratos, motos, clientes] = await Promise.all([datos.contratos(), datos.motos(), datos.clientes()]);
    const cliente = new Map(clientes.map((c) => [c.id, c]));
    const porMoto = new Map<string, (Contrato & { cliente?: Cliente })[]>();
    for (const c of contratos) (porMoto.get(c.moto_id) ?? porMoto.set(c.moto_id, []).get(c.moto_id))?.push({ ...c, cliente: cliente.get(c.cliente_id) });
    return motos
      .filter((m) => porMoto.has(m.id))
      .map((m): Ficha => {
        const suyos = (porMoto.get(m.id) ?? []).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
        return {
          moto: m,
          contratos: suyos,
          clave: claveBusqueda(m.placa, m.marca, m.tipo, ...suyos.flatMap((c) => [c.cliente?.nombres, c.cliente?.dni])),
          ultimo: suyos[0]?.fecha_inicio ?? "",
        };
      })
      .sort((a, b) => b.ultimo.localeCompare(a.ultimo));
  }, [datos]);

  const lista = useMemo(() => {
    const q = normalizar(texto);
    return filtrarPorEmpresa((fichas ?? []).map((f) => ({ ...f, empresa_id: f.moto.empresa_id })), empresa).filter(
      (f) => (!estado || f.contratos.some((c) => c.estado === estado)) && (!q || coincide(f.clave, q)),
    );
  }, [fichas, texto, estado, empresa]);

  return (
    <>
      <TituloPagina
        titulo="Histórico"
        sub="Cada vehículo con todos sus contratos: quién lo tuvo, desde cuándo y cómo terminó. También los archivados, aunque ya no estén en la empresa."
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setCuantos(POR_PAGINA);
          }}
          placeholder="Buscar por placa, cliente o DNI"
          aria-label="Buscar en el histórico"
          className="min-h-14 flex-1 rounded-2xl border border-borde bg-superficie px-5 text-lg focus:border-marca focus:ring-3 focus:ring-marca/20 focus:outline-none"
        />
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.valor || "todos"}
              type="button"
              aria-pressed={estado === f.valor}
              onClick={() => setEstado(f.valor)}
              className={`min-h-12 rounded-xl border px-4 font-semibold whitespace-nowrap ${estado === f.valor ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"}`}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !fichas ? (
        <Cargando variante="tarjetas" />
      ) : lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde bg-superficie p-8 text-center text-tenue">No hay vehículos con esa búsqueda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.slice(0, cuantos).map((f) => (
            <TarjetaVehiculo key={f.moto.id} ficha={f} conEmpresa={conEmpresa} />
          ))}
        </ul>
      )}
      {lista.length > cuantos && (
        <div className="mt-4 flex justify-center">
          <Boton variante="secundario" onClick={() => setCuantos((n) => n + POR_PAGINA)}>
            Ver {Math.min(POR_PAGINA, lista.length - cuantos)} más
          </Boton>
        </div>
      )}
    </>
  );
}

function TarjetaVehiculo({ ficha: { moto, contratos }, conEmpresa }: { ficha: Ficha; conEmpresa: (h: string) => string }) {
  return (
    <li className="rounded-2xl border border-borde bg-superficie p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <IconoVehiculo tipo={moto.tipo} className="h-7 w-10" />
        <Placa placa={moto.placa} tramite={moto.placa_tramite} />
        <span className="font-semibold">
          {[moto.marca, moto.tipo, moto.color].filter(Boolean).join(" · ")}
        </span>
        {moto.archivado && <span className="rounded-full bg-fondo px-2.5 py-0.5 text-xs font-bold text-tenue">Archivado</span>}
        <span className="ml-auto text-sm text-tenue">{contratos.length === 1 ? "1 contrato" : `${contratos.length} contratos`}</span>
      </div>
      <ol className="flex flex-col gap-2 border-l-2 border-marca/30 pl-4">
        {contratos.map((c) => (
          <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${COLOR_ESTADO[c.estado]}`}>{NOMBRE_ESTADO_CONTRATO[c.estado]}</span>
            {c.cliente ? (
              <Link href={conEmpresa(`/clientes/ficha?id=${c.cliente.id}`)} className="font-semibold hover:text-marca hover:underline">
                {c.cliente.nombres}
                {c.cliente.archivado ? " (archivado)" : ""}
              </Link>
            ) : (
              <span className="text-tenue">Cliente eliminado</span>
            )}
            <span className="text-sm text-tenue">
              {formatoFecha(c.fecha_inicio)} → {formatoFecha(fechaCuota(c.fecha_inicio, c.nro_cuotas - 1, c.frecuencia))} · {c.nro_cuotas} × {formatoSoles(c.monto_cuota)} (
              {nombreCuota(c.frecuencia).replace("Cuota ", "")})
            </span>
            {c.estado === "anulado" && c.cerrado_motivo && <span className="text-sm text-rojo">Motivo: {c.cerrado_motivo}</span>}
            <Link href={conEmpresa(`/contratos/ver?id=${c.id}`)} className="text-sm font-semibold text-marca underline">
              Ver pagos
            </Link>
          </li>
        ))}
      </ol>
    </li>
  );
}

export default function PaginaHistorico() {
  return (
    <SoloAdmin>
      <Historico />
    </SoloAdmin>
  );
}
