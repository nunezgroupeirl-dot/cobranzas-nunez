"use client";
import type { CamposContrato } from "@/components/reportes/ContratoImpreso";
import { PASOS, pasoListo } from "./pasos";

/** Barra de avance de la pasarela: cada paso con su número; los completos van con ✓. */
export function Avance({ actual, valores, alIr }: { actual: number; valores: CamposContrato; alIr: (i: number) => void }) {
  const nombres = [...PASOS.map((p) => p.corto), "Revisar"];
  const listos = PASOS.filter((_, i) => pasoListo(i, valores)).length;
  return (
    <nav aria-label="Pasos del contrato" className="rounded-2xl border border-borde bg-superficie p-3">
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-fondo" role="progressbar" aria-valuemin={0} aria-valuemax={PASOS.length} aria-valuenow={listos}>
        <div className="h-full rounded-full bg-marca transition-[width]" style={{ width: `${(listos / PASOS.length) * 100}%` }} />
      </div>
      <ol className="grid grid-cols-5 gap-1">
        {nombres.map((n, i) => {
          const listo = i < PASOS.length ? pasoListo(i, valores) : listos === PASOS.length;
          const esActual = i === actual;
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => alIr(i)}
                aria-current={esActual ? "step" : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-semibold sm:text-sm ${esActual ? "bg-marca-suave text-marca-oscura" : "text-tenue hover:bg-fondo"}`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
                    listo ? "border-marca bg-marca text-white" : esActual ? "border-marca text-marca" : "border-borde"
                  }`}
                >
                  {listo ? "✓" : i + 1}
                </span>
                <span className="leading-tight">{n}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
