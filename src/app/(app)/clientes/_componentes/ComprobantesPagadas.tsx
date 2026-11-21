"use client";
import { Boton, Campo, OpcionesBoton, Selector, hoyLima } from "@/components/ui";
import { opcionesDeCuenta } from "@/lib/cuentas";
import type { Cuenta } from "@/types/database";
import { FotoVoucher, OPCIONES_MEDIO } from "../../contratos/_componentes/ComprobanteAnterior";
import { comprobanteVacio, type ComprobanteVenta } from "./venta";

interface Props {
  /** las cuotas pagadas que necesitan comprobante (1, 2, 3…) */
  faltan: number[];
  comprobantes: ComprobanteVenta[];
  alCambiar: (lista: ComprobanteVenta[]) => void;
  archivos: Record<string, File>;
  alElegirArchivo: (id: string, archivo: File | null) => void;
  cuentas: Cuenta[];
  empresaId: string;
  nombresEmpresa: Map<string, string>;
  error?: string;
}

/**
 * Obligatorio cuando el cliente ya venía pagando: el comprobante de esas cuotas (foto, fecha, medio, cuenta y N.º de
 * operación). Se registran como pagos anteriores al guardar, con el mismo control de capturas y operaciones repetidas.
 */
export function ComprobantesPagadas({ faltan, comprobantes, alCambiar, archivos, alElegirArchivo, cuentas, empresaId, nombresEmpresa, error }: Props) {
  if (!faltan.length) return null;
  const lista = comprobantes.length ? comprobantes : [];
  const cubiertas = new Set(lista.flatMap((c) => c.cuotas));
  const listas = faltan.filter((n) => cubiertas.has(n)).length;
  const cambiar = (id: string, cambio: Partial<ComprobanteVenta>) => alCambiar(lista.map((c) => (c.id === id ? { ...c, ...cambio } : c)));
  const agregar = () => {
    // el nuevo arranca con las cuotas que aún no tienen comprobante
    const libres = faltan.filter((n) => !cubiertas.has(n));
    alCambiar([...lista, { ...comprobanteVacio(hoyLima()), cuotas: libres }]);
  };

  return (
    <section className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${error ? "border-rojo" : "border-marca/50"} bg-marca-suave/40`} aria-label="Comprobantes de las cuotas pagadas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-bold">
          Comprobantes de las cuotas pagadas <span className="text-rojo">*</span>
        </h4>
        <span className={`num rounded-full px-2.5 py-0.5 text-sm font-semibold ${listas === faltan.length ? "bg-verde-suave text-verde" : "bg-amarillo-suave text-amarillo"}`}>
          {listas} de {faltan.length} {faltan.length === 1 ? "cuota" : "cuotas"} con comprobante
        </span>
      </div>
      <p className="text-sm text-tenue">
        Sube la captura o el voucher de cada pago y marca qué cuotas cubre. Si un depósito pagó varias cuotas, márcalas todas en el mismo comprobante.
      </p>

      {lista.map((c, i) => {
        const efectivo = c.medio === "efectivo";
        // las cuotas que puede marcar: las suyas y las que ningún otro comprobante tiene
        const otras = new Set(lista.filter((x) => x.id !== c.id).flatMap((x) => x.cuotas));
        const opcionesCuenta = opcionesDeCuenta(
          cuentas.filter((x) => x.medio === c.medio || (c.medio === "agente" && x.medio === "banco")),
          empresaId,
          nombresEmpresa,
        );
        return (
          <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Comprobante {i + 1}</span>
              <button
                type="button"
                onClick={() => {
                  alCambiar(lista.filter((x) => x.id !== c.id));
                  alElegirArchivo(c.id, null);
                }}
                className="min-h-11 px-2 text-sm font-semibold text-rojo"
              >
                Quitar
              </button>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">¿Qué cuotas pagó con este comprobante?</p>
              <div className="flex flex-wrap gap-1.5">
                {faltan.map((n) => {
                  const marcada = c.cuotas.includes(n);
                  const ocupada = !marcada && otras.has(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={ocupada}
                      aria-pressed={marcada}
                      onClick={() => cambiar(c.id, { cuotas: marcada ? c.cuotas.filter((x) => x !== n) : [...c.cuotas, n].sort((a, b) => a - b) })}
                      className={`num min-h-11 min-w-11 rounded-xl border-2 px-2 font-bold ${
                        marcada ? "border-marca bg-marca text-white" : ocupada ? "border-borde text-tenue line-through" : "border-borde bg-superficie hover:border-marca"
                      }`}
                      title={ocupada ? "Ya está en otro comprobante" : undefined}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
            <OpcionesBoton etiqueta="Medio" opciones={OPCIONES_MEDIO} valor={c.medio} alCambiar={(m) => cambiar(c.id, { medio: m as ComprobanteVenta["medio"], cuenta_id: "" })} obligatorio />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Fecha del pago" type="date" max={hoyLima()} value={c.fecha} onChange={(e) => cambiar(c.id, { fecha: e.target.value })} obligatorio />
              {!efectivo && (
                <Campo
                  etiqueta="N.º de operación"
                  value={c.nro_operacion}
                  onChange={(e) => cambiar(c.id, { nro_operacion: e.target.value.trim() })}
                  inputMode="numeric"
                  obligatorio
                />
              )}
              {!efectivo && (
                <div className="sm:col-span-2">
                  <Selector etiqueta="Cuenta donde llegó" opciones={opcionesCuenta} value={c.cuenta_id} onChange={(e) => cambiar(c.id, { cuenta_id: e.target.value })} vacio="Elige…" obligatorio />
                </div>
              )}
            </div>
            <FotoVoucher foto={archivos[c.id] ?? null} efectivo={efectivo} alCambiar={(f) => alElegirArchivo(c.id, f)} />
          </div>
        );
      })}

      <Boton variante="secundario" onClick={agregar} className="self-start">
        + {lista.length ? "Agregar otro comprobante" : "Agregar comprobante"}
      </Boton>
      {error && <p className="text-sm font-semibold text-rojo">{error}</p>}
    </section>
  );
}
