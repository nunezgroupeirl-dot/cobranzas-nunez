import { formatoSoles } from "@/components/ui";
import type { CobranzaSemana, ResumenEmpresa } from "@/types/database";
import { etiquetaSemana } from "./semanas";

interface Props {
  semana: string;
  filas: CobranzaSemana[];
  empresas: Pick<ResumenEmpresa, "empresa_id" | "empresa">[];
}

/** Lo que pasó en la semana elegida del gráfico, total y por empresa. */
export function DetalleSemana({ semana, filas, empresas }: Props) {
  const nombre = new Map(empresas.map((e) => [e.empresa_id, e.empresa]));
  const deLaSemana = filas.filter((f) => f.semana === semana && nombre.has(f.empresa_id));
  const cobrado = deLaSemana.reduce((t, f) => t + f.cobrado, 0);
  const esperado = deLaSemana.reduce((t, f) => t + f.esperado, 0);
  const falta = Math.max(0, esperado - cobrado);
  const pct = esperado > 0 ? Math.round((cobrado / esperado) * 100) : null;

  return (
    <div aria-live="polite" className="rounded-xl bg-fondo p-4">
      <p className="text-sm text-tenue">Semana del {etiquetaSemana(semana)}</p>
      <p className="num font-display text-3xl font-bold">{formatoSoles(cobrado)}</p>
      <p className="num text-sm text-tenue">
        de {formatoSoles(esperado)} {pct !== null && <b className="text-tinta">· {pct}%</b>}
      </p>
      {falta > 0 && <p className="num mt-1 text-sm font-semibold text-rojo">Faltó {formatoSoles(falta)}</p>}
      <ul className="mt-3 flex flex-col gap-2.5 border-t border-borde pt-3">
        {deLaSemana.map((f) => {
          const avance = f.esperado > 0 ? Math.min(100, (f.cobrado / f.esperado) * 100) : 0;
          return (
            <li key={f.empresa_id}>
              <p className="flex justify-between gap-2 text-sm">
                <span className="truncate">{nombre.get(f.empresa_id)}</span>
                <span className="num shrink-0 font-semibold">{formatoSoles(f.cobrado)}</span>
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie">
                <div className="h-full rounded-full bg-marca" style={{ width: `${avance}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
