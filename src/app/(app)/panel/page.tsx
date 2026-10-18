"use client";
import Link from "next/link";
import { SoloAdmin, useSesion } from "@/components/layout/Sesion";
import { useEmpresa } from "@/components/layout/empresa";
import { Aviso, Cargando, Tarjeta, TituloPagina, formatoFecha, formatoSoles, hoyLima, useCarga } from "@/components/ui";
import type { ResumenEmpresa } from "@/types/database";

function Cifra({ titulo, valor, nota, tono = "tinta" }: { titulo: string; valor: string; nota?: string; tono?: "tinta" | "verde" | "rojo" }) {
  const color = { tinta: "text-tinta", verde: "text-verde", rojo: "text-rojo" }[tono];
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4 sm:p-5">
      <p className="text-sm font-semibold text-tenue">{titulo}</p>
      <p className={`num mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl ${color}`}>{valor}</p>
      {nota && <p className="mt-1 text-sm text-tenue">{nota}</p>}
    </div>
  );
}

function BarraColores({ v, a, r }: { v: number; a: number; r: number }) {
  const total = v + a + r || 1;
  const tramo = (n: number, clase: string, texto: string) =>
    n > 0 && (
      <div className={`${clase} flex items-center justify-center text-sm font-bold text-white`} style={{ width: `${(n / total) * 100}%` }} title={`${texto}: ${n}`}>
        {n}
      </div>
    );
  return (
    <div className="flex h-9 w-full overflow-hidden rounded-xl bg-fondo">
      {tramo(v, "bg-verde", "Al día")}
      {tramo(a, "bg-amarillo", "1 a 3 semanas")}
      {tramo(r, "bg-rojo", "4 o más semanas")}
    </div>
  );
}

function Panel() {
  const { datos } = useSesion();
  const empresa = useEmpresa();
  const { datos: filas, cargando, error } = useCarga(() => datos.resumenEmpresas(), [datos]);

  if (cargando && !filas) return <Cargando />;
  if (error) return <Aviso tipo="error">{error}</Aviso>;
  const lista = (filas ?? []).filter((f) => !empresa || f.empresa_id === empresa);
  const suma = (k: keyof ResumenEmpresa) => lista.reduce((s, f) => s + Number(f[k]), 0);
  const cobradoSemana = suma("cobrado_semana");
  const esperado = suma("esperado_semana");
  const avance = esperado > 0 ? Math.min(100, Math.round((cobradoSemana / esperado) * 100)) : 0;

  return (
    <>
      <TituloPagina titulo="Panel del dueño" sub={`Hoy ${formatoFecha(hoyLima())} · ${empresa ? lista[0]?.empresa ?? "" : "Todas las empresas"}`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Cobrado hoy" valor={formatoSoles(suma("cobrado_hoy"))} tono="verde" />
        <Cifra titulo="Cobrado esta semana" valor={formatoSoles(cobradoSemana)} nota={`de ${formatoSoles(esperado)} esperados`} />
        <Cifra titulo="Deuda vencida" valor={formatoSoles(suma("deuda"))} tono="rojo" />
        <Cifra titulo="Clientes activos" valor={String(suma("clientes_verde") + suma("clientes_amarillo") + suma("clientes_rojo"))} nota={`${suma("clientes_rojo")} en rojo`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Avance de la semana">
          <div className="flex items-baseline justify-between">
            <span className="num text-3xl font-extrabold">{avance}%</span>
            <span className="text-tenue">
              {formatoSoles(cobradoSemana)} / {formatoSoles(esperado)}
            </span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-fondo">
            <div className="h-full rounded-full bg-marca transition-[width] duration-500" style={{ width: `${avance}%` }} />
          </div>
          <p className="mt-2 text-sm text-tenue">Semana de lunes a domingo. Lo registrado después de las 10:00 p.m. cuenta para el día siguiente.</p>
        </Tarjeta>
        <Tarjeta titulo="Clientes por color">
          <BarraColores v={suma("clientes_verde")} a={suma("clientes_amarillo")} r={suma("clientes_rojo")} />
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span>🟢 Al día: {suma("clientes_verde")}</span>
            <span>🟡 1–3 semanas: {suma("clientes_amarillo")}</span>
            <span>🔴 4 o más: {suma("clientes_rojo")}</span>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta className="mt-4" titulo="Por empresa">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="text-sm text-tenue">
              <tr>
                <th className="py-2 pr-3">Empresa</th>
                <th className="py-2 pr-3 text-right">Hoy</th>
                <th className="py-2 pr-3 text-right">Semana</th>
                <th className="py-2 pr-3 text-right">Esperado</th>
                <th className="py-2 pr-3 w-48">Clientes</th>
                <th className="py-2 pr-3 text-right">Deuda</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.empresa_id} className="border-t border-borde">
                  <td className="py-3 pr-3 font-semibold">{f.empresa}</td>
                  <td className="num py-3 pr-3 text-right">{formatoSoles(f.cobrado_hoy)}</td>
                  <td className="num py-3 pr-3 text-right">{formatoSoles(f.cobrado_semana)}</td>
                  <td className="num py-3 pr-3 text-right text-tenue">{formatoSoles(f.esperado_semana)}</td>
                  <td className="py-3 pr-3">
                    <BarraColores v={f.clientes_verde} a={f.clientes_amarillo} r={f.clientes_rojo} />
                  </td>
                  <td className="num py-3 pr-3 text-right font-bold text-rojo">{formatoSoles(f.deuda)}</td>
                  <td className="py-3 text-right">
                    <Link href={`/morosos?empresa=${f.empresa_id}`} className="font-semibold whitespace-nowrap text-marca">
                      Ver morosos →
                    </Link>
                  </td>
                </tr>
              ))}
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
