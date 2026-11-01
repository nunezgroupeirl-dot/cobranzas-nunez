"use client";
import type { KeyboardEvent } from "react";
import { formatoSoles } from "@/components/ui";
import { etiquetaSemana } from "./semanas";

export interface Semana {
  semana: string; // lunes, AAAA-MM-DD
  cobrado: number;
  esperado: number;
}


interface Props {
  semanas: Semana[];
  elegida: string;
  alElegir: (semana: string) => void;
}

/**
 * Cobrado contra esperado de las últimas semanas. Cada semana es un botón:
 * la columna clara es lo que vencía y la oscura lo que entró.
 * Flechas izquierda/derecha para moverse entre semanas.
 */
export function GraficoSemanas({ semanas, elegida, alElegir }: Props) {
  const tope = Math.max(1, ...semanas.map((s) => Math.max(s.cobrado, s.esperado)));
  const ultima = semanas.length - 1;

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = semanas.findIndex((s) => s.semana === elegida);
    const siguiente = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? ultima : -2;
    if (siguiente === -2 || siguiente < 0 || siguiente > ultima) return;
    e.preventDefault();
    alElegir(semanas[siguiente].semana);
    document.getElementById(`semana-${semanas[siguiente].semana}`)?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Semanas" onKeyDown={teclas} className="grid h-56 items-end gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
      {semanas.map((s, i) => {
        const activa = s.semana === elegida;
        const pct = s.esperado > 0 ? Math.round((s.cobrado / s.esperado) * 100) : null;
        return (
          <button
            key={s.semana}
            id={`semana-${s.semana}`}
            type="button"
            role="radio"
            aria-checked={activa}
            tabIndex={activa ? 0 : -1}
            onClick={() => alElegir(s.semana)}
            aria-label={`Semana del ${etiquetaSemana(s.semana)}: cobrado ${formatoSoles(s.cobrado)} de ${formatoSoles(s.esperado)}`}
            className={`group flex h-full flex-col items-stretch justify-end gap-1.5 rounded-xl px-0.5 pt-2 pb-1 sm:px-1.5 ${activa ? "bg-marca-suave" : "hover:bg-fondo"}`}
          >
            <span className={`num text-center text-xs font-semibold ${activa ? "text-marca-oscura" : "text-tenue"}`}>{pct === null ? "—" : `${pct}%`}</span>
            <span className="relative flex-1">
              {/* lo que vencía */}
              <span className="absolute inset-x-0 bottom-0 rounded-t-md bg-borde/70" style={{ height: `${(s.esperado / tope) * 100}%` }} />
              {/* lo que entró */}
              <span
                className={`absolute inset-x-1.5 bottom-0 rounded-t-md transition-[height] duration-500 sm:inset-x-2.5 ${activa ? "bg-marca" : "bg-marca/55 group-hover:bg-marca/75"}`}
                style={{ height: `${(s.cobrado / tope) * 100}%` }}
              />
            </span>
            <span className={`text-center text-xs whitespace-nowrap ${activa ? "font-bold text-tinta" : "text-tenue"}`}>{i === ultima ? "Esta sem." : etiquetaSemana(s.semana)}</span>
          </button>
        );
      })}
    </div>
  );
}
