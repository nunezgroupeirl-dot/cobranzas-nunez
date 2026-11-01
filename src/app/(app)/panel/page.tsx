"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { Aviso, Cargando, Tarjeta, TituloPagina, formatoFecha, formatoSoles, hoyLima, useCarga } from "@/components/ui";
import type { ResumenEmpresa } from "@/types/database";
import { BarraColores } from "./_componentes/BarraColores";
import { DetalleSemana } from "./_componentes/DetalleSemana";
import { GraficoSemanas, type Semana } from "./_componentes/GraficoSemanas";

const SEMANAS = 8;

function Panel() {
  const { datos } = useSesion();
  const empresa = useEmpresa();
  const { datos: info, cargando, error } = useCarga(async () => {
    const [resumen, semanal] = await Promise.all([datos.resumenEmpresas(), datos.cobranzaSemanal(SEMANAS)]);
    return { resumen, semanal };
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
    };
  }, [info, empresa]);

  if (cargando && !info) return <Cargando />;
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
              <span>Semana de lunes a domingo. Después de las 10:00 p.m. cuenta para el día siguiente.</span>
            </p>
          </div>
          <DetalleSemana semana={semanaElegida} filas={vista.filas} empresas={vista.lista} />
        </div>
      </Tarjeta>

      <Tarjeta className="mt-4" titulo="Por empresa">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="text-sm text-tenue">
              <tr>
                <th className="py-2 pr-3 font-semibold">Empresa</th>
                <th className="py-2 pr-3 text-right font-semibold">Hoy</th>
                <th className="py-2 pr-3 font-semibold">Semana</th>
                <th className="w-44 py-2 pr-3 font-semibold">Clientes</th>
                <th className="py-2 pr-3 text-right font-semibold">Deuda</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {vista.lista.map((f) => {
                const avance = f.esperado_semana > 0 ? Math.min(100, (f.cobrado_semana / f.esperado_semana) * 100) : 0;
                return (
                  <tr key={f.empresa_id} className="border-t border-borde align-middle">
                    <td className="py-3 pr-3 font-semibold">{f.empresa}</td>
                    <td className="num py-3 pr-3 text-right">{formatoSoles(f.cobrado_hoy)}</td>
                    <td className="py-3 pr-3">
                      <p className="num text-sm whitespace-nowrap">
                        {formatoSoles(f.cobrado_semana)} <span className="text-tenue">de {formatoSoles(f.esperado_semana)}</span>
                      </p>
                      <div className="mt-1 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-fondo">
                        <div className="h-full rounded-full bg-marca" style={{ width: `${avance}%` }} />
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <BarraColores v={f.clientes_verde} a={f.clientes_amarillo} r={f.clientes_rojo} enlace empresa={f.empresa_id} alto="h-7" />
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
