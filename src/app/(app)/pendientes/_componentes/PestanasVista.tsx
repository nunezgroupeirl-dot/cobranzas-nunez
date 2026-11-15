import { VISTAS, type Vista } from "./faltantes";

const NOMBRES_VISTA = Object.keys(VISTAS) as Vista[];

/** Pestañas "Cliente y moto" / "Contratos": el contrato va aparte. */
export function PestanasVista({ vista, cuentas, alCambiar }: { vista: Vista; cuentas: Record<Vista, number>; alCambiar: (v: Vista) => void }) {
  return (
    <div role="tablist" aria-label="Qué completar" className="mb-4 flex gap-1 rounded-2xl border border-borde bg-superficie p-1">
      {NOMBRES_VISTA.map((v) => {
        const elegida = vista === v;
        const alerta = v === "contratos" && cuentas[v] > 0;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={elegida}
            onClick={() => alCambiar(v)}
            className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 font-semibold transition ${
              elegida ? "bg-tinta text-white" : "text-tenue hover:bg-fondo hover:text-tinta"
            }`}
          >
            {VISTAS[v].titulo}
            <span className={`num rounded-full px-2 py-0.5 text-xs font-bold ${alerta ? "bg-rojo text-white" : elegida ? "bg-white/20" : "bg-fondo"}`}>{cuentas[v]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Aviso "Importante" de la pestaña Contratos. */
export function AvisoContratos({ cuantos }: { cuantos: number }) {
  return (
    <div role="alert" className="mb-4 flex gap-3 rounded-2xl border-2 border-rojo/50 bg-rojo-suave p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rojo text-lg font-extrabold text-white" aria-hidden>
        !
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-bold text-rojo">
          Importante: {cuantos} {cuantos === 1 ? "contrato aún no está firmado" : "contratos aún no están firmados"} en el sistema
        </p>
        <p className="text-sm text-tinta">
          Un contrato sin firmar no respalda la entrega de la moto si hay que reclamarla. Cada uno se llena aquí, se imprime, lo firma el cliente con su huella y
          se sube escaneado. El número rojo del menú avisa hasta que no quede ninguno.
        </p>
      </div>
    </div>
  );
}
