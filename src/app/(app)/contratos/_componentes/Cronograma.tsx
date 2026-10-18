import { NOMBRE_ESTADO_CUOTA, formatoFecha, formatoSoles } from "@/components/ui";
import type { Cuota, EstadoCuota } from "@/types/database";

const ESTILO: Record<EstadoCuota, string> = {
  pagada_a_tiempo: "border-verde/30 bg-verde-suave",
  pagada_con_atraso: "border-amarillo/40 bg-amarillo-suave",
  vencida: "border-rojo/40 bg-rojo-suave",
  pendiente: "border-borde bg-superficie",
};
const MARCA: Record<EstadoCuota, string> = {
  pagada_a_tiempo: "text-verde",
  pagada_con_atraso: "text-amarillo",
  vencida: "text-rojo",
  pendiente: "text-tenue",
};

export function LeyendaCronograma({ cuotas }: { cuotas: Pick<Cuota, "estado">[] }) {
  const cuenta = (e: EstadoCuota) => cuotas.filter((c) => c.estado === e).length;
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {(Object.keys(NOMBRE_ESTADO_CUOTA) as EstadoCuota[]).map((e) => (
        <span key={e} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold ${ESTILO[e]}`}>
          <span className={MARCA[e]}>●</span>
          {NOMBRE_ESTADO_CUOTA[e]}: {cuenta(e)}
        </span>
      ))}
    </div>
  );
}

/** Cuadrícula de cuotas con sus 4 estados. Los estados vienen calculados por la base de datos. */
export function Cronograma({ cuotas }: { cuotas: Pick<Cuota, "numero" | "fecha_vencimiento" | "monto" | "monto_pagado" | "fecha_pago" | "estado">[] }) {
  return (
    <div className="flex flex-col gap-3">
      <LeyendaCronograma cuotas={cuotas} />
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cuotas.map((c) => (
          <li key={c.numero} className={`rounded-xl border p-2.5 text-sm ${ESTILO[c.estado]}`} title={NOMBRE_ESTADO_CUOTA[c.estado]}>
            <div className="flex items-center justify-between">
              <span className="font-bold">N.º {c.numero}</span>
              <span className={`text-xs font-bold ${MARCA[c.estado]}`}>{NOMBRE_ESTADO_CUOTA[c.estado].split(" ")[0]}</span>
            </div>
            <p className="num">{formatoFecha(c.fecha_vencimiento)}</p>
            <p className="num font-semibold">{formatoSoles(c.monto)}</p>
            {c.estado === "pagada_con_atraso" && <p className="text-xs font-semibold text-amarillo">Pagó {formatoFecha(c.fecha_pago)}</p>}
            {c.estado === "pagada_a_tiempo" && <p className="text-xs text-verde">Pagó {formatoFecha(c.fecha_pago)}</p>}
            {(c.estado === "vencida" || c.estado === "pendiente") && c.monto_pagado > 0 && (
              <p className="text-xs font-semibold">A cuenta {formatoSoles(c.monto_pagado)}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
