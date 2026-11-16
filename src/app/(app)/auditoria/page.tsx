"use client";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, Cargando, Selector, TituloPagina, formatoFechaHora, useCarga } from "@/components/ui";
import type { Auditoria } from "@/types/database";
import { Foto } from "../clientes/_componentes/Foto";
import { describir, type Contexto } from "./_componentes/describir";

const POR_PAGINA = 100;
const QUE = [
  { valor: "pagos", texto: "Pagos" },
  { valor: "", texto: "Todo" },
  { valor: "clientes", texto: "Clientes" },
  { valor: "motos", texto: "Vehículos" },
  { valor: "contratos", texto: "Contratos" },
  { valor: "documentos", texto: "Fotos y documentos" },
  { valor: "perfiles", texto: "Usuarios" },
  { valor: "empresas", texto: "Empresas" },
  { valor: "cuentas", texto: "Cuentas" },
];

/** Quién hizo qué y cuándo: la base de datos anota sola cada cambio (no se puede borrar desde la app). */
function PaginaAuditoria() {
  const { datos } = useSesion();
  const [tabla, setTabla] = useState("pagos");
  const [usuario, setUsuario] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [paginas, setPaginas] = useState(1);

  // nombres para describir cada movimiento (cliente, placa, usuario)
  const { datos: base } = useCarga(async () => {
    const [usuarios, contratos, clientes, motos] = await Promise.all([datos.usuarios(), datos.contratos(), datos.clientes(), datos.motos()]);
    const cliente = new Map(clientes.map((c) => [c.id, c.nombres]));
    const placa = new Map(motos.map((m) => [m.id, m.placa ?? (m.placa_tramite ? "placa en trámite" : "")]));
    const ctx: Contexto = {
      cliente,
      placa,
      contrato: new Map(contratos.map((c) => [c.id, { cliente: cliente.get(c.cliente_id) ?? "", placa: placa.get(c.moto_id) ?? "" }])),
    };
    return { usuarios, ctx };
  }, [datos]);

  const { datos: filas, cargando, error } = useCarga(
    () => datos.auditoria({ tabla: tabla || undefined, usuario_id: usuario || undefined, desde: desde || undefined, hasta: hasta || undefined, limite: POR_PAGINA * paginas }),
    [datos, tabla, usuario, desde, hasta, paginas],
  );
  const nombre = useMemo(() => new Map((base?.usuarios ?? []).map((u) => [u.id, u.nombre])), [base]);
  const filtrar = (f: () => void) => {
    f();
    setPaginas(1);
  };

  return (
    <>
      <TituloPagina
        titulo="Auditoría"
        sub="Quién registró cada pago, quién creó o cambió clientes, vehículos y contratos, y cuándo. Se anota solo y nadie lo puede borrar desde el sistema."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Qué ver">
        {QUE.map((q) => (
          <button
            key={q.valor || "todo"}
            type="button"
            aria-pressed={tabla === q.valor}
            onClick={() => filtrar(() => setTabla(q.valor))}
            className={`min-h-11 rounded-xl border px-4 font-semibold ${tabla === q.valor ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"}`}
          >
            {q.texto}
          </button>
        ))}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Selector
          etiqueta="Quién"
          opciones={(base?.usuarios ?? []).map((u) => ({ valor: u.id, texto: u.nombre }))}
          value={usuario}
          onChange={(e) => filtrar(() => setUsuario(e.target.value))}
          vacio="Todos"
        />
        <Campo etiqueta="Desde" type="date" value={desde} onChange={(e) => filtrar(() => setDesde(e.target.value))} />
        <Campo etiqueta="Hasta" type="date" value={hasta} onChange={(e) => filtrar(() => setHasta(e.target.value))} />
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !filas ? (
        <Cargando />
      ) : !filas?.length ? (
        <p className="rounded-2xl border border-dashed border-borde bg-superficie p-8 text-center text-tenue">No hay movimientos con estos filtros.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((a) => (
            <Movimiento key={a.id} a={a} quien={a.usuario_id ? (nombre.get(a.usuario_id) ?? "Usuario eliminado") : "El sistema"} ctx={base?.ctx} />
          ))}
        </ul>
      )}
      {filas && filas.length >= POR_PAGINA * paginas && (
        <div className="mt-4 flex justify-center">
          <Boton variante="secundario" cargando={cargando} onClick={() => setPaginas((n) => n + 1)}>
            Ver más
          </Boton>
        </div>
      )}
    </>
  );
}

function Movimiento({ a, quien, ctx }: { a: Auditoria; quien: string; ctx?: Contexto }) {
  const { texto, foto } = ctx ? describir(a, ctx) : { texto: `${a.accion} en ${a.tabla}`, foto: undefined };
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3">
      {foto && <Foto bucket="evidencias" ruta={foto} titulo="Comprobante" className="size-14 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{quien}</p>
        <p className="text-sm">{texto}</p>
      </div>
      <p className="shrink-0 text-right text-sm text-tenue">{formatoFechaHora(a.creado_en)}</p>
    </li>
  );
}

export default function Pagina() {
  return (
    <SoloAdmin>
      <PaginaAuditoria />
    </SoloAdmin>
  );
}
