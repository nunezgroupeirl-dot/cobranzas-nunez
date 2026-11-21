"use client";
import { Campo, OpcionesBoton, Selector, fechaLarga, hoyLima } from "@/components/ui";
import { opcionesDeCuenta } from "@/lib/cuentas";
import type { Cuenta } from "@/types/database";
import { FotoVoucher, OPCIONES_MEDIO } from "../../contratos/_componentes/ComprobanteAnterior";
import type { ComprobanteVenta } from "./venta";

interface Props {
  /** las cuotas pagadas que necesitan comprobante (1, 2, 3…) */
  faltan: number[];
  /** clave del vehículo en el formulario: cada comprobante es "<vehículo>-cuota-<n>" */
  prefijo: string;
  comprobantes: ComprobanteVenta[];
  alCambiar: (lista: ComprobanteVenta[]) => void;
  archivos: Record<string, File>;
  alElegirArchivo: (id: string, archivo: File | null) => void;
  /** fecha en que vencía cada cuota (para guiarse y como fecha de pago por defecto) */
  fechaDe: (n: number) => string | null;
  /** si la captura de ese comprobante es la misma que la de otra cuota: su número */
  repetidaDe: (id: string) => number | null;
  cuentas: Cuenta[];
  empresaId: string;
  nombresEmpresa: Map<string, string>;
  error?: string;
}

export const idComprobante = (prefijo: string, n: number) => `${prefijo}-cuota-${n}`;

/**
 * Obligatorio cuando el cliente ya venía pagando: una ventanita por cada cuota pagada, cada una con su propio
 * comprobante (captura, fecha, medio, cuenta y N.º de operación). No se puede repetir la captura ni el número.
 * Al guardar, cada una queda como pago de su cuota.
 */
export function ComprobantesPagadas({ faltan, prefijo, comprobantes, alCambiar, archivos, alElegirArchivo, fechaDe, repetidaDe, cuentas, empresaId, nombresEmpresa, error }: Props) {
  if (!faltan.length) return null;
  const hoy = hoyLima();
  const deCuota = (n: number) => comprobantes.find((c) => c.cuotas.includes(n));
  // al tocar una cuota por primera vez se crea su comprobante: con el medio y la cuenta de la cuota anterior (suelen repetirse)
  const cambiar = (n: number, cambio: Partial<ComprobanteVenta>) => {
    const actual = deCuota(n);
    const anterior = [...faltan.filter((x) => x < n)].reverse().map(deCuota).find(Boolean);
    const vence = fechaDe(n);
    const base: ComprobanteVenta = actual ?? {
      id: idComprobante(prefijo, n),
      cuotas: [n],
      fecha: vence && vence <= hoy ? vence : hoy,
      medio: anterior?.medio ?? "yape",
      cuenta_id: anterior?.cuenta_id ?? "",
      nro_operacion: "",
    };
    const nuevo = { ...base, ...cambio };
    alCambiar([...comprobantes.filter((c) => c.id !== nuevo.id && !c.cuotas.includes(n)), nuevo].sort((a, b) => a.cuotas[0] - b.cuotas[0]));
  };
  const completa = (n: number) => {
    const c = deCuota(n);
    return !!c && !!archivos[c.id] && !repetidaDe(c.id) && !!c.fecha && (c.medio === "efectivo" || (!!c.cuenta_id && !!c.nro_operacion.trim()));
  };
  const listas = faltan.filter(completa).length;

  return (
    <section className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${error ? "border-rojo" : "border-marca/50"} bg-marca-suave/40`} aria-label="Comprobantes de las cuotas pagadas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-bold">
          Comprobantes de las cuotas pagadas <span className="text-rojo">*</span>
        </h4>
        <span className={`num rounded-full px-2.5 py-0.5 text-sm font-semibold ${listas === faltan.length ? "bg-verde-suave text-verde" : "bg-amarillo-suave text-amarillo"}`}>
          {listas} de {faltan.length} listas
        </span>
      </div>
      <p className="text-sm text-tenue">Cada cuota lleva su propio comprobante: su captura y su N.º de operación no se pueden repetir en otra cuota.</p>

      <div className="grid gap-3 lg:grid-cols-2">
        {faltan.map((n) => {
          const c = deCuota(n);
          const medio = c?.medio ?? [...faltan.filter((x) => x < n)].reverse().map(deCuota).find(Boolean)?.medio ?? "yape";
          const efectivo = medio === "efectivo";
          const vence = fechaDe(n);
          const repetida = c ? repetidaDe(c.id) : null;
          const ok = completa(n);
          const opcionesCuenta = opcionesDeCuenta(
            cuentas.filter((x) => x.medio === medio || (medio === "agente" && x.medio === "banco")),
            empresaId,
            nombresEmpresa,
          );
          return (
            <div key={n} className={`flex flex-col gap-3 rounded-xl border-2 bg-superficie p-3 ${ok ? "border-verde/60" : "border-borde"}`} data-cuota={n}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">Cuota {n}</p>
                  {vence && <p className="text-sm text-tenue">Vencía el {fechaLarga(vence)}</p>}
                </div>
                {ok && (
                  <span className="rounded-full bg-verde-suave px-2.5 py-0.5 text-sm font-bold text-verde" aria-label="Completa">
                    ✓ Lista
                  </span>
                )}
              </div>
              <OpcionesBoton
                etiqueta="Medio"
                opciones={OPCIONES_MEDIO}
                valor={medio}
                alCambiar={(m) => cambiar(n, { medio: m as ComprobanteVenta["medio"], cuenta_id: "" })}
                obligatorio
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Fecha del pago" type="date" max={hoy} value={c?.fecha ?? (vence && vence <= hoy ? vence : hoy)} onChange={(e) => cambiar(n, { fecha: e.target.value })} obligatorio />
                {!efectivo && (
                  <Campo
                    etiqueta="N.º de operación"
                    value={c?.nro_operacion ?? ""}
                    onChange={(e) => cambiar(n, { nro_operacion: e.target.value.trim() })}
                    inputMode="numeric"
                    obligatorio
                  />
                )}
                {!efectivo && (
                  <div className="sm:col-span-2">
                    <Selector etiqueta="Cuenta donde llegó" opciones={opcionesCuenta} value={c?.cuenta_id ?? ""} onChange={(e) => cambiar(n, { cuenta_id: e.target.value })} vacio="Elige…" obligatorio />
                  </div>
                )}
              </div>
              <FotoVoucher
                foto={c ? (archivos[c.id] ?? null) : null}
                efectivo={efectivo}
                error={repetida ? `Es la misma captura de la cuota ${repetida}. Sube la de esta cuota.` : undefined}
                alCambiar={(f) => {
                  if (!c) cambiar(n, {}); // crea su comprobante para poder guardarle la foto
                  alElegirArchivo(idComprobante(prefijo, n), f);
                }}
              />
            </div>
          );
        })}
      </div>
      {error && <p className="text-sm font-semibold text-rojo">{error}</p>}
    </section>
  );
}
