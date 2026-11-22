"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { useConEmpresa, useEmpresa } from "@/components/layout/empresa";
import { Aviso, BotonEnlace, COLOR_HEX, Cargando, EtiquetaSemaforo, Tabla, TituloPagina, formatoFecha, formatoSoles, textoDocumento, useCarga, type Columna, Placa, IconoVehiculo, OtrasPlacas } from "@/components/ui";
import type { Color, EstadoCliente, Moto, ResumenEmpresa } from "@/types/database";
import { alfabetico } from "@/lib/texto";
import { claveBusqueda, coincide, normalizar } from "./_componentes/buscar";

type Fila = EstadoCliente & {
  sin_contrato?: boolean;
  moto?: Moto;
  /** ya terminó (o cerró) sus contratos */
  tuvo?: boolean;
  /** cliente con varios vehículos: una fila que los resume y se despliega con la flecha */
  vehiculos?: Fila[];
  /** fila de un vehículo desplegado: su número (Vehículo 1, 2…) */
  numero?: number;
  /** empresas de sus vehículos (para filtrar) */
  empresas?: string[];
  /** cuándo se registró el cliente */
  registrado?: string;
};

/** Fecha (en hora de Lima) en que se registró, y "hoy", "ayer" o "hace N días" debajo. */
function Registrado({ iso }: { iso?: string }) {
  if (!iso) return <span className="text-tenue">—</span>;
  const enLima = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Lima" }); // AAAA-MM-DD
  const dia = enLima(new Date(iso));
  const dias = Math.round((Date.parse(enLima(new Date())) - Date.parse(dia)) / 86_400_000);
  const [a, m, d] = dia.split("-");
  return (
    <span className="flex flex-col leading-tight">
      <span className="num">{`${d}/${m}/${a}`}</span>
      <span className={`text-xs ${dias <= 1 ? "font-semibold text-marca" : "text-tenue"}`}>{dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`}</span>
    </span>
  );
}

const PEOR: Record<Color, number> = { verde: 0, amarillo: 1, rojo: 2 };

/** Una fila por cliente: si tiene varios vehículos, resume su estado (el peor), su deuda (la suma) y su último pago. */
function agrupar(filas: Fila[]): Fila[] {
  if (filas.length === 1) return filas;
  const peor = filas.reduce((a, b) => (PEOR[b.color] > PEOR[a.color] || (b.color === a.color && b.semanas_atraso > a.semanas_atraso) ? b : a));
  const nombres = [...new Set(filas.map((f) => f.empresa))];
  return [
    {
      ...peor,
      deuda: filas.reduce((n, f) => n + f.deuda, 0),
      ultimo_pago: filas.map((f) => f.ultimo_pago).reduce((a, b) => (b && (!a || b > a) ? b : a), null as string | null),
      empresa: nombres.join(" · "),
      empresas: [...new Set(filas.map((f) => f.empresa_id))],
      vehiculos: filas.map((f, i) => ({ ...f, numero: i + 1 })),
    },
  ];
}

const COLORES_VALIDOS = new Set<string>(["verde", "amarillo", "rojo", "atraso"]);
/** Filtro de estado: un color del semáforo, o "atraso" (1–3 sem. y 4+ sem. juntos). */
type FiltroColor = Color | "atraso" | "";

export default function PaginaClientes() {
  const { datos, esAdmin, empresas } = useSesion();
  const router = useRouter();
  // la empresa elegida arriba (vale para todo el sistema) o la tarjeta tocada aquí (solo esta lista)
  const empresaGlobal = useEmpresa();
  // (si cambian la empresa de arriba, la tarjeta tocada deja de valer)
  const [tocada, setTocada] = useState<{ id: string | null; con: string | null }>({ id: null, con: null });
  const empresaLocal = tocada.con === empresaGlobal ? tocada.id : null;
  const setEmpresaLocal = (id: string | null) => setTocada({ id, con: empresaGlobal });
  const empresa = empresaLocal ?? empresaGlobal;
  const conEmpresa = useConEmpresa();
  const [texto, setTexto] = useState("");
  // ?color=rojo llega desde el semáforo del panel
  const colorInicial = useSearchParams().get("color") ?? "";
  const [color, setColor] = useState<FiltroColor>(() => (COLORES_VALIDOS.has(colorInicial) ? (colorInicial as FiltroColor) : ""));
  // orden de la lista: por nombre, o por fecha de registro (la flechita cambia entre recientes y antiguos)
  const [orden, setOrden] = useState<"nombre" | "recientes" | "antiguos">("nombre");
  // clientes con varios vehículos que están desplegados
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  // vehículos por empresa (solo el administrador)
  const { datos: resumen } = useCarga(async () => (esAdmin ? datos.resumenEmpresas().catch(() => [] as ResumenEmpresa[]) : []), [datos, esAdmin]);

  const { datos: filas, cargando, error } = useCarga(async () => {
    const [estado, clientes, contratos, motos] = await Promise.all([datos.estadoClientes(), datos.clientes(), datos.contratos(), datos.motos()]);
    const conContrato = new Set(estado.map((e) => e.cliente_id));
    // el vehículo que cada cliente tiene en su poder: la moto de su contrato (o la suya, si aún no tiene contrato)
    const motoPorId = new Map(motos.map((m) => [m.id, m]));
    const motoDeContrato = new Map(contratos.map((c) => [c.id, motoPorId.get(c.moto_id)]));
    const motoDeCliente = new Map(motos.filter((m) => m.cliente_id).map((m) => [m.cliente_id, m]));
    const tuvieron = new Set(contratos.map((c) => c.cliente_id));
    const sinContrato: Fila[] = clientes
      .filter((c) => !conContrato.has(c.id) && !c.archivado)
      .map((c) => ({
        contrato_id: "",
        cliente_id: c.id,
        cliente: c.nombres,
        dni: c.dni,
        tipo_doc: c.tipo_doc,
        placa: motoDeCliente.get(c.id)?.placa ?? "",
        celular: c.celular,
        celular2: c.celular2,
        empresa_id: c.empresa_id,
        empresa: empresas.find((e) => e.id === c.empresa_id)?.nombre ?? "",
        cuota: 0,
        semanas_atraso: 0,
        deuda: 0,
        color: "verde",
        ultimo_pago: null,
        proxima_cuota: null,
        sin_contrato: true,
        tuvo: tuvieron.has(c.id),
        moto: motoDeCliente.get(c.id),
      }));
    // un cliente con varios vehículos sale una sola vez (Vehículo 1, 2… en el orden en que se registraron)
    const creado = new Map(contratos.map((c) => [c.id, c.creado_en]));
    const porCliente = new Map<string, Fila[]>();
    for (const e of [...estado].sort((a, b) => (creado.get(a.contrato_id) ?? "").localeCompare(creado.get(b.contrato_id) ?? "")))
      (porCliente.get(e.cliente_id) ?? porCliente.set(e.cliente_id, []).get(e.cliente_id))?.push({ ...e, moto: motoDeContrato.get(e.contrato_id) });
    const registro = new Map(clientes.map((c) => [c.id, c.creado_en]));
    return [...[...porCliente.values()].flatMap(agrupar), ...sinContrato].map((f) => ({ ...f, registrado: registro.get(f.cliente_id) }));
  }, [datos, empresas]);

  // clave de búsqueda por fila, calculada solo cuando llegan los datos
  // (con varios vehículos, se busca también por la placa de cada uno)
  const indice = useMemo(
    () => new Map((filas ?? []).map((f) => [f, claveBusqueda(f.cliente, f.dni, f.celular, f.celular2, ...(f.vehiculos ?? [f]).flatMap((v) => [v.placa, v.otras_placas]))])),
    [filas],
  );

  const visibles = useMemo(() => {
    const q = normalizar(texto);
    const deEmpresa = (f: Fila) => !empresa || (f.empresas ?? [f.empresa_id]).includes(empresa);
    // "Al día" = todos sus vehículos al día; "Con atraso" = alguno debe (igual que en las tarjetas por empresa)
    const deColor = (f: Fila) => {
      if (!color) return true;
      if (f.sin_contrato) return false;
      const vs = f.vehiculos ?? [f];
      if (color === "verde") return vs.every((v) => v.color === "verde");
      if (color === "atraso") return vs.some((v) => v.color !== "verde");
      return vs.some((v) => v.color === color);
    };
    return (filas ?? [])
      .filter((f) => deEmpresa(f) && deColor(f) && coincide(indice.get(f) ?? "", q))
      .sort((a, b) =>
        orden === "nombre"
          ? alfabetico(a.cliente, b.cliente)
          : (orden === "recientes" ? -1 : 1) * (a.registrado ?? "").localeCompare(b.registrado ?? "") || alfabetico(a.cliente, b.cliente),
      )
      .flatMap((f) => (f.vehiculos && abiertos.has(f.cliente_id) ? [f, ...f.vehiculos] : [f]));
  }, [filas, indice, texto, color, empresa, abiertos, orden]);
  const clientesVisibles = visibles.filter((f) => !f.numero).length;

  // numeración: 1, 2, 3… por cliente (los vehículos desplegados no cuentan)
  const numeros = new Map<Fila, number>();
  for (const f of visibles) if (!f.numero) numeros.set(f, numeros.size + 1);

  const columnas: Columna<Fila>[] = [
    { clave: "n", titulo: "N.º", celda: (f) => (f.numero ? null : <span className="num text-sm font-semibold text-tenue">{numeros.get(f)}</span>) },
    {
      clave: "cliente",
      titulo: "Cliente",
      celda: (f) =>
        f.numero ? (
          <span className="pl-4 text-sm font-semibold text-tenue">↳ Vehículo {f.numero}</span>
        ) : (
          <span className="font-semibold">{f.cliente}</span>
        ),
    },
    { clave: "dni", titulo: "Documento", celda: (f) => (f.dni && !f.numero ? <span className="num">{textoDocumento(f.dni, f.tipo_doc)}</span> : null) },
    {
      clave: "placa",
      titulo: "Vehículo",
      celda: (f) =>
        f.vehiculos ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // la flecha despliega; el resto de la fila abre la ficha
              alternar(f.cliente_id);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-expanded={abiertos.has(f.cliente_id)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-borde bg-fondo px-3 font-semibold whitespace-nowrap hover:border-marca"
          >
            <span aria-hidden className={`inline-block transition-transform ${abiertos.has(f.cliente_id) ? "rotate-90" : ""}`}>
              ▸
            </span>
            <IconoVehiculo tipo={f.vehiculos[0].moto?.tipo} />
            {f.vehiculos.length} vehículos
          </button>
        ) : f.moto || f.placa ? (
          <span className="flex items-center gap-2">
            <IconoVehiculo tipo={f.moto?.tipo} />
            <Placa placa={f.moto?.placa ?? f.placa} tramite={f.moto?.placa_tramite} tamano="chico" />
            <OtrasPlacas placas={f.otras_placas} />
          </span>
        ) : (
          <span className="text-tenue">—</span>
        ),
    },
    { clave: "empresa", titulo: "Empresa", celda: (f) => f.empresa || "—", ocultarEnMovil: true },
    {
      clave: "estado",
      titulo: "Estado",
      celda: (f) =>
        f.sin_contrato ? (
          f.tuvo ? (
            <span className="rounded-full bg-marca-suave px-2.5 py-1 text-xs font-bold text-marca-oscura">Sin contrato activo</span>
          ) : (
            <span className="rounded-full bg-amarillo-suave px-2.5 py-1 text-xs font-bold text-amarillo">Falta contrato</span>
          )
        ) : (
          <EtiquetaSemaforo color={f.color} semanas={f.semanas_atraso} />
        ),
    },
    { clave: "deuda", titulo: "Deuda", numero: true, celda: (f) => (f.sin_contrato ? "—" : formatoSoles(f.deuda)) },
    { clave: "ultimo", titulo: "Último pago", celda: (f) => formatoFecha(f.ultimo_pago), ocultarEnMovil: true },
    { clave: "registrado", titulo: "Registrado", celda: (f) => (f.numero ? null : <Registrado iso={f.registrado} />) },
  ];

  const colores: { valor: FiltroColor; texto: string }[] = [
    { valor: "", texto: "Todos" },
    { valor: "verde", texto: "Al día" },
    { valor: "atraso", texto: "Con atraso" },
    { valor: "amarillo", texto: "1–3 sem." },
    { valor: "rojo", texto: "4+ sem." },
  ];

  return (
    <>
      <TituloPagina
        titulo="Clientes"
        sub={filas ? `${clientesVisibles} de ${filas.length}` : undefined}
        accion={
          esAdmin && (
            <BotonEnlace href={conEmpresa("/clientes/nuevo")} tamano="grande">
              + Nuevo cliente
            </BotonEnlace>
          )
        }
      />

      {filas && (
        <ClientesPorEmpresa
          filas={filas}
          empresas={empresas}
          resumen={resumen ?? []}
          elegida={empresa}
          color={color}
          alElegir={(id, c) => {
            setColor(c);
            setEmpresaLocal(id);
            if (!id && empresaGlobal) router.replace("/clientes");
          }}
        />
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, DNI, placa o celular"
          aria-label="Buscar cliente"
          className="min-h-14 flex-1 rounded-2xl border border-borde bg-superficie px-5 text-lg focus:border-marca focus:ring-3 focus:ring-marca/20 focus:outline-none"
        />
        <div className="flex gap-2" role="group" aria-label="Ordenar">
          <button
            type="button"
            onClick={() => setOrden("nombre")}
            aria-pressed={orden === "nombre"}
            className={`min-h-12 rounded-xl border px-4 font-semibold whitespace-nowrap ${orden === "nombre" ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"}`}
          >
            A–Z
          </button>
          <button
            type="button"
            // primero "más recientes"; si ya está así, la flechita lo cambia a "más antiguos" (y viceversa)
            onClick={() => setOrden(orden === "recientes" ? "antiguos" : "recientes")}
            aria-pressed={orden !== "nombre"}
            title="Ordenar por fecha de registro"
            className={`flex min-h-12 items-center gap-2 rounded-xl border px-4 font-semibold whitespace-nowrap ${orden !== "nombre" ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"}`}
          >
            <span aria-hidden className="text-lg leading-none">
              {orden === "antiguos" ? "↑" : "↓"}
            </span>
            {orden === "antiguos" ? "Más antiguos" : "Más recientes"}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por color">
          {colores.map((c) => (
            <button
              key={c.valor || "todos"}
              onClick={() => setColor(c.valor)}
              aria-pressed={color === c.valor}
              className={`min-h-12 rounded-xl border px-4 font-semibold whitespace-nowrap ${
                color === c.valor ? "border-tinta bg-tinta text-white" : "border-borde bg-superficie"
              }`}
            >
              {c.texto}
            </button>
          ))}
        </div>
      </div>

      {(empresa || color || texto) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-marca/40 bg-marca-suave/40 px-4 py-2">
          <span className="text-sm">
            Mostrando{" "}
            <b>
              {[
                empresa ? (empresas.find((e) => e.id === empresa)?.nombre ?? "una empresa") : "todas las empresas",
                color === "verde" ? "al día" : color === "atraso" ? "con atraso" : color === "amarillo" ? "1–3 semanas" : color === "rojo" ? "4+ semanas" : "",
                texto ? `«${texto}»` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </b>
          </span>
          <button
            type="button"
            onClick={() => {
              setEmpresaLocal(null);
              setColor("");
              setTexto("");
              if (empresaGlobal) router.replace("/clientes");
            }}
            className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl border border-tinta bg-tinta px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            ✕ Ver todos los clientes
          </button>
        </div>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !filas ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnas}
          filas={visibles}
          claveFila={(f) => (f.vehiculos ? `grupo-${f.cliente_id}` : f.contrato_id || `cli-${f.cliente_id}`)}
          // un vehículo desplegado abre la ficha en su pestaña
          alTocar={(f) => router.push(conEmpresa(`/clientes/ficha?id=${f.cliente_id}${f.numero ? `&contrato=${f.contrato_id}` : ""}`))}
          claseFila={(f) => (f.numero ? "ml-6 bg-fondo/60 md:ml-0" : undefined)}
          acento={(f) => (f.sin_contrato ? undefined : COLOR_HEX[f.color])}
          vacio={texto ? "No se encontró ningún cliente con esa búsqueda." : "Todavía no hay clientes."}
        />
      )}
    </>
  );
}

/**
 * Una tarjeta por empresa con cuántos clientes y vehículos tiene. Tocar la tarjeta muestra solo sus clientes;
 * tocar "al día" o "con atraso" muestra solo esos (de esa empresa). Tocarla otra vez vuelve a todas.
 */
function ClientesPorEmpresa({
  filas,
  empresas,
  resumen,
  elegida,
  color,
  alElegir,
}: {
  filas: Fila[];
  empresas: { id: string; nombre: string }[];
  resumen: ResumenEmpresa[];
  elegida: string | null;
  color: FiltroColor;
  alElegir: (empresa: string | null, color: FiltroColor) => void;
}) {
  const vehiculosDe = new Map(resumen.map((r) => [r.empresa_id, r.vehiculos]));
  const tarjetas = empresas.map((e) => {
    const suyas = filas.filter((f) => (f.empresas ?? [f.empresa_id]).includes(e.id));
    return {
      ...e,
      clientes: suyas.length,
      alDia: suyas.filter((f) => !f.sin_contrato && (f.vehiculos ?? [f]).every((v) => v.color === "verde")).length,
      atrasados: suyas.filter((f) => !f.sin_contrato && (f.vehiculos ?? [f]).some((v) => v.color !== "verde")).length,
      sinContrato: suyas.filter((f) => f.sin_contrato).length,
      vehiculos: vehiculosDe.get(e.id),
    };
  });
  const chip = (activo: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${activo ? "border-tinta bg-tinta text-white" : "border-borde bg-fondo hover:border-marca"}`;
  return (
    <section className="mb-5" aria-label="Clientes por empresa">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Por empresa</h2>
        <p className="text-sm text-tenue">
          <b className="num text-tinta">{filas.length}</b> clientes en total · toca una empresa para ver sus clientes
        </p>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
        {tarjetas.map((t) => {
          const activa = elegida === t.id;
          return (
            <div
              key={t.id}
              className={`flex w-64 shrink-0 snap-start flex-col rounded-2xl border-2 bg-superficie transition-colors sm:w-auto ${activa ? "border-marca" : elegida ? "border-borde opacity-60 hover:opacity-100" : "border-borde hover:border-marca"}`}
            >
              <button
                type="button"
                onClick={() => alElegir(activa && !color ? null : t.id, "")}
                aria-pressed={activa && !color}
                title={activa ? "Ver todas las empresas" : "Ver todos los clientes de esta empresa"}
                className="flex flex-1 flex-col p-4 pb-2 text-left"
              >
                <span className="line-clamp-2 min-h-10 text-sm leading-tight font-bold">{t.nombre}</span>
                <span className="mt-2 flex items-baseline gap-2">
                  <span className="num font-display text-3xl font-bold">{t.clientes}</span>
                  <span className="text-sm text-tenue">
                    clientes{t.vehiculos !== undefined ? ` · ${t.vehiculos} vehículos` : ""}
                  </span>
                </span>
              </button>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                <button type="button" onClick={() => alElegir(t.id, activa && color === "verde" ? "" : "verde")} aria-pressed={activa && color === "verde"} className={chip(activa && color === "verde")}>
                  <span className="text-verde" aria-hidden>●</span> {t.alDia} al día
                </button>
                <button type="button" onClick={() => alElegir(t.id, activa && color === "atraso" ? "" : "atraso")} aria-pressed={activa && color === "atraso"} className={chip(activa && color === "atraso")}>
                  <span className="text-rojo" aria-hidden>●</span> {t.atrasados} con atraso
                </button>
                {t.sinContrato > 0 && (
                  <span className="inline-flex min-h-9 items-center gap-1.5 px-1 text-xs text-amarillo">● {t.sinContrato} sin contrato</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
