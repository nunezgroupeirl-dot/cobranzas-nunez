"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { Aviso, Cargando, Tarjeta, TituloPagina, formatoFecha, formatoSoles, hoyLima, useCarga } from "@/components/ui";
import type { ResumenEmpresa } from "@/types/database";
import { BarraColores } from "./_componentes/BarraColores";
import { DetalleSemana } from "./_componentes/DetalleSemana";
import { EspacioFotos } from "./_componentes/EspacioFotos";
import { GraficoSemanas, type Semana } from "./_componentes/GraficoSemanas";
import { Ingresos } from "./_componentes/Ingresos";

const SEMANAS = 8;
/** Con R2 configurado las fotos no ocupan Supabase: el medidor no hace falta. */

function Panel() {
  const { datos } = useSesion();
  const empresa = useEmpresa();
  const { datos: info, cargando, error } = useCarga(async () => {
    const [resumen, semanal, fotos] = await Promise.all([
      datos.resumenEmpresas(),
      datos.cobranzaSemanal(SEMANAS),
      datos.usoFotos().catch(() => null),
    ]);
    return { resumen, semanal, fotos };
  }, [datos]);
  const [elegida, setElegida] = useState<string | null>(null);

  const vista = useMemo(() => {
    if (!info) return null;
    const lista = info.resumen.filter((f) => !empresa || f.empresa_id === empresa);
    const filas = info.semanal.filter((f) => !empresa || f.empresa_id === empresa);
    // una barra por semana (suma de las empresas visibles)
    const porSemana = new Map<string, Semana>();
    for (const f of filas) {
      const s = porSemana.get(f.semana) ?? { semana: f.semana, cobrado: 0, esperado: 0 };
      s.cobrado += f.cobrado;
      s.esperado += f.esperado;
      porSemana.set(f.semana, s);
    }
    const suma = (k: keyof ResumenEmpresa) => lista.reduce((t, f) => t + Number(f[k]), 0);
    return {
      lista,
      filas,
      semanas: [...porSemana.values()].sort((a, b) => a.semana.localeCompare(b.semana)),
      hoy: suma("cobrado_hoy"),
      deuda: suma("deuda"),
      verde: suma("clientes_verde"),
      amarillo: suma("clientes_amarillo"),
      rojo: suma("clientes_rojo"),
      // con todas las empresas, el total de clientes cuenta una vez al que tiene vehículos en dos empresas
      clientes: empresa ? suma("clientes_registrados") : (info.resumen[0]?.clientes_total ?? suma("clientes_registrados")),
      vehiculos: suma("vehiculos"),
      porCobrar: suma("por_cobrar"),
    };
  }, [info, empresa]);

  if (cargando && !info) return <Cargando variante="panel" />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!vista) return null;

  const semanaElegida = elegida ?? vista.semanas.at(-1)?.semana ?? "";
  const activos = vista.verde + vista.amarillo + vista.rojo;
  const nombreEmpresa = empresa ? (vista.lista[0]?.empresa ?? "") : "Las 4 empresas";

  return (
    <>
      <TituloPagina titulo="Panel del dueño" sub={`${nombreEmpresa} · hoy ${formatoFecha(hoyLima())}`} />

      {/* Lo del día, en una sola franja */}
      <section className="grid overflow-hidden rounded-2xl border border-borde bg-superficie sm:grid-cols-[1fr_1fr_1.4fr]" aria-label="Resumen de hoy">
        <div className="p-4 sm:p-5">
          <p className="text-sm font-semibold text-tenue">Cobrado hoy</p>
          <p className="num font-display text-4xl font-bold text-verde">{formatoSoles(vista.hoy)}</p>
        </div>
        <div className="border-t border-borde p-4 sm:border-t-0 sm:border-l sm:p-5">
          <p className="text-sm font-semibold text-tenue">Deuda vencida</p>
          <p className="num font-display text-4xl font-bold text-rojo">{formatoSoles(vista.deuda)}</p>
        </div>
        <div className="border-t border-borde p-4 sm:border-t-0 sm:border-l sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-tenue">Clientes activos</p>
            <p className="num font-display text-2xl font-bold">{activos}</p>
          </div>
          <div className="mt-2">
            <BarraColores v={vista.verde} a={vista.amarillo} r={vista.rojo} enlace empresa={empresa} />
          </div>
          <p className="mt-1.5 text-xs text-tenue">Toca un color para ver esos clientes.</p>
        </div>
      </section>

      {/* Lo cobrado por días (lo principal), semanas, meses y años, y por qué medio */}
      <Ingresos empresa={empresa} />

      {/* Lo registrado: clientes, vehículos y todo lo que falta cobrar */}
      <section className="mt-4 grid overflow-hidden rounded-2xl border border-borde bg-superficie sm:grid-cols-3" aria-label="Registrados">
        <div className="p-4 sm:p-5">
          <p className="text-sm font-semibold text-tenue">Clientes registrados</p>
          <p className="num font-display text-3xl font-bold">{vista.clientes.toLocaleString("es-PE")}</p>
        </div>
        <div className="border-t border-borde p-4 sm:border-t-0 sm:border-l sm:p-5">
          <p className="text-sm font-semibold text-tenue">Vehículos registrados</p>
          <p className="num font-display text-3xl font-bold">{vista.vehiculos.toLocaleString("es-PE")}</p>
        </div>
        <div className="border-t border-borde p-4 sm:border-t-0 sm:border-l sm:p-5">
          <p className="text-sm font-semibold text-tenue">Deuda total por cobrar</p>
          <p className="num font-display text-3xl font-bold text-marca">{formatoSoles(vista.porCobrar)}</p>
          <p className="mt-1 text-xs text-tenue">Lo que falta pagar de los contratos activos (vencido + por vencer).</p>
        </div>
      </section>

      <Tarjeta className="mt-4" titulo={`Cobrado contra esperado · últimas ${SEMANAS} semanas`}>
        <div className="grid gap-5 lg:grid-cols-[1fr_17rem]">
          <div>
            <GraficoSemanas semanas={vista.semanas} elegida={semanaElegida} alElegir={setElegida} />
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-marca" aria-hidden /> Cobrado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-borde" aria-hidden /> Cuotas que vencían
              </span>
              <span>Semana de lunes a domingo. El día cambia a medianoche.</span>
            </p>
          </div>
          <DetalleSemana semana={semanaElegida} filas={vista.filas} empresas={vista.lista} />
        </div>
      </Tarjeta>

      {info?.fotos && <EspacioFotos {...info.fotos} />}

      <Tarjeta className="mt-4" titulo="Por empresa">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="text-sm text-tenue">
              <tr>
                <th className="py-2 pr-3 font-semibold">Empresa</th>
                <th className="py-2 pr-3 text-right font-semibold">Hoy</th>
                <th className="py-2 pr-3 font-semibold">Ingresado · falta cobrar</th>
                <th className="w-44 py-2 pr-3 font-semibold">Clientes</th>
                <th className="py-2 pr-3 text-right font-semibold">Registrados</th>
                <th className="py-2 pr-3 text-right font-semibold">Vencido</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {vista.lista.map((f) => {
                // lo que ya entró (iniciales + cuotas cobradas) frente a lo que falta cobrar de los contratos activos
                const ingresado = Number(f.cobrado_total ?? 0) + Number(f.iniciales ?? 0);
                const falta = Number(f.por_cobrar ?? 0);
                const avance = ingresado + falta > 0 ? Math.min(100, (ingresado / (ingresado + falta)) * 100) : 0;
                return (
                  <tr key={f.empresa_id} className="border-t border-borde align-middle">
                    <td className="py-3 pr-3 font-semibold">{f.empresa}</td>
                    <td className="num py-3 pr-3 text-right">{formatoSoles(f.cobrado_hoy)}</td>
                    <td className="py-3 pr-3">
                      <p className="num text-sm whitespace-nowrap">
                        <b className="text-verde">{formatoSoles(ingresado)}</b> <span className="text-tenue">ingresado</span>
                      </p>
                      <div className="mt-1 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-borde" title={`${Math.round(avance)} % cobrado`}>
                        <div className="h-full rounded-full bg-verde" style={{ width: `${avance}%` }} />
                      </div>
                      <p className="num mt-1 text-sm whitespace-nowrap">
                        <b className="text-marca">{formatoSoles(falta)}</b> <span className="text-tenue">falta cobrar</span>
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <BarraColores v={f.clientes_verde} a={f.clientes_amarillo} r={f.clientes_rojo} enlace empresa={f.empresa_id} alto="h-7" />
                    </td>
                    <td className="py-3 pr-3 text-right text-sm whitespace-nowrap">
                      <span className="num font-semibold">{f.clientes_registrados ?? 0}</span> clientes
                      <br />
                      <span className="num font-semibold">{f.vehiculos ?? 0}</span> vehículos
                    </td>
                    <td className="num py-3 pr-3 text-right font-bold text-rojo">{formatoSoles(f.deuda)}</td>
                    <td className="py-3 text-right">
                      <Link href={`/morosos?empresa=${f.empresa_id}`} className="font-semibold whitespace-nowrap text-marca hover:underline">
                        Ver morosos
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </>
  );
}

export default function PaginaPanel() {
  return (
    <SoloAdmin>
      <Panel />
    </SoloAdmin>
  );
}
