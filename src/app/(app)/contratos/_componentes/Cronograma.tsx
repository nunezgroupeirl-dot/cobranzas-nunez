import { NOMBRE_ESTADO_CUOTA, diaSemana, formatoFecha, formatoSoles } from "@/components/ui";
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

type CuotaVista = Pick<Cuota, "numero" | "fecha_vencimiento" | "monto" | "monto_pagado" | "fecha_pago" | "estado">;

/** Qué se puede hacer con cada cuota: elegir las del cuaderno sin comprobante, o ver el voucher de las pagadas. */
export interface SeleccionCuotas {
  elegibles: Set<number>;
  elegidas: Set<number>;
  alTocar: (numero: number) => void;
  /** cuotas con algún pago registrado: al tocarlas se ve su voucher */
  conVoucher?: Set<number>;
  alVer?: (numero: number) => void;
}

/** Cuadrícula de cuotas con sus 4 estados. Los estados vienen calculados por la base de datos. */
export function Cronograma({ cuotas, seleccion }: { cuotas: CuotaVista[]; seleccion?: SeleccionCuotas }) {
  return (
    <div className="flex flex-col gap-3">
      <LeyendaCronograma cuotas={cuotas} />
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cuotas.map((c) => {
          const elegible = seleccion?.elegibles.has(c.numero) ?? false;
          const elegida = seleccion?.elegidas.has(c.numero) ?? false;
          const voucher = !elegible && (seleccion?.conVoucher?.has(c.numero) ?? false);
          return (
            <li key={c.numero} className="flex">
              {voucher ? (
                <button
                  type="button"
                  onClick={() => seleccion?.alVer?.(c.numero)}
                  className={`flex-1 rounded-xl border p-2.5 text-left text-sm transition hover:ring-2 hover:ring-marca/40 ${ESTILO[c.estado]}`}
                  title="Ver el voucher de esta cuota"
                >
                  <Celda c={c} />
                  <span className="mt-1 inline-block text-xs font-bold text-marca underline">Ver voucher</span>
                </button>
              ) : elegible ? (
                <button
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => seleccion?.alTocar(c.numero)}
                  className={`flex-1 rounded-xl border p-2.5 text-left text-sm transition ${ESTILO[c.estado]} ${
                    elegida ? "ring-3 ring-marca" : "hover:ring-2 hover:ring-marca/40"
                  }`}
                  title="Tocar para subir su comprobante"
                >
                  <Celda c={c} elegida={elegida} />
                </button>
              ) : (
                <div className={`flex-1 rounded-xl border p-2.5 text-sm ${ESTILO[c.estado]}`} title={NOMBRE_ESTADO_CUOTA[c.estado]}>
                  <Celda c={c} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Celda({ c, elegida }: { c: CuotaVista; elegida?: boolean }) {
  const pagada = c.estado === "pagada_a_tiempo" || c.estado === "pagada_con_atraso";
  // pagada sin fecha = la dio por pagada el cuaderno: aún no tiene su comprobante en el sistema
  const delCuaderno = pagada && !c.fecha_pago;
  return (
    <>
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold">N.º {c.numero}</span>
        {elegida !== undefined ? (
          <span className={`grid size-5 place-items-center rounded-md border-2 text-xs font-bold ${elegida ? "border-marca bg-marca text-white" : "border-marca/50 bg-white"}`} aria-hidden>
            {elegida ? "✓" : ""}
          </span>
        ) : (
          <span className={`text-xs font-bold ${MARCA[c.estado]}`}>{NOMBRE_ESTADO_CUOTA[c.estado].split(" ")[0]}</span>
        )}
      </div>
      <p className="text-sm leading-tight font-extrabold text-marca uppercase">{diaSemana(c.fecha_vencimiento)}</p>
      <p className="num">{formatoFecha(c.fecha_vencimiento)}</p>
      <p className="num font-semibold">{formatoSoles(c.monto)}</p>
      {delCuaderno && <p className="text-xs font-semibold text-tenue">Del cuaderno · sin comprobante</p>}
      {!delCuaderno && c.estado === "pagada_con_atraso" && <p className="text-xs font-semibold text-amarillo">Pagó {formatoFecha(c.fecha_pago)}</p>}
      {!delCuaderno && c.estado === "pagada_a_tiempo" && <p className="text-xs text-verde">Pagó {formatoFecha(c.fecha_pago)}</p>}
      {!pagada && c.monto_pagado > 0 && <p className="text-xs font-semibold">A cuenta {formatoSoles(c.monto_pagado)}</p>}
    </>
  );
}
