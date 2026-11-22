"use client";
import { Boton, Campo, OpcionesBoton } from "@/components/ui";
import { TIPOS_MOTO } from "@/lib/placa";
import { CampoPlaca } from "../../contratos/_componentes/CampoPlaca";
import { CamposFichaTecnica } from "../../contratos/_componentes/FichaTecnica";
import { extraVacio, type Venta, type VehiculoExtra } from "./venta";

/**
 * Venta de varios vehículos con un solo contrato y un solo cronograma (p. ej. 3 mototaxis):
 * el vehículo de arriba es el 1; aquí se agregan los demás con su placa y sus datos para el contrato.
 */
export function VehiculosExtra({ v, alCambiar, error }: { v: Venta; alCambiar: (cambio: Partial<Venta>) => void; error?: string }) {
  const cambiar = (clave: string, cambio: Partial<VehiculoExtra>) => alCambiar({ extras: v.extras.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)) });
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${v.varios ? (error ? "border-rojo" : "border-marca/50") : "border-dashed border-borde"}`} aria-label="Varios vehículos en un contrato">
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-marca"
          checked={v.varios}
          onChange={(e) => alCambiar({ varios: e.target.checked, extras: e.target.checked && !v.extras.length ? [extraVacio(v.tipo)] : v.extras })}
        />
        <span>
          <span className="font-semibold">Venta de varios vehículos en este contrato</span>
          <span className="block text-sm text-tenue">Un solo contrato y un solo cronograma de pagos para todos (p. ej. 3 mototaxis). En el contrato salen todas las placas.</span>
        </span>
      </label>

      {v.varios && (
        <>
          {v.extras.map((x, i) => (
            <div key={x.clave} className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-3" data-extra={i + 2}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">Vehículo {i + 2}</span>
                <button type="button" onClick={() => alCambiar({ extras: v.extras.filter((y) => y.clave !== x.clave) })} className="min-h-11 px-2 text-sm font-semibold text-rojo">
                  Quitar
                </button>
              </div>
              <OpcionesBoton etiqueta="Tipo" opciones={TIPOS_MOTO.map((t) => ({ valor: t, texto: t }))} valor={x.tipo} alCambiar={(t) => cambiar(x.clave, { tipo: t })} obligatorio />
              <div className="grid gap-3 sm:grid-cols-3">
                <CampoPlaca
                  placa={x.placa}
                  tramite={x.tramite}
                  alCambiarPlaca={(p) => cambiar(x.clave, { placa: p })}
                  alCambiarTramite={(t) => cambiar(x.clave, { tramite: t, placa: t ? "" : x.placa })}
                />
                <Campo etiqueta="Marca" value={x.marca} onChange={(e) => cambiar(x.clave, { marca: e.target.value })} obligatorio />
                <Campo etiqueta="Color" value={x.color} onChange={(e) => cambiar(x.clave, { color: e.target.value })} />
              </div>
              <CamposFichaTecnica valores={x} alCambiar={(k, val) => cambiar(x.clave, { [k]: val })} />
            </div>
          ))}
          <Boton variante="secundario" onClick={() => alCambiar({ extras: [...v.extras, extraVacio(v.tipo)] })} className="self-start">
            + Agregar otro vehículo a este contrato
          </Boton>
          <p className="text-sm text-tenue">
            Son <b>{v.extras.length + 1} vehículos</b> en un solo cronograma: la cuota y el n.º de cuotas de arriba son por todos juntos.
          </p>
        </>
      )}
      {error && <p className="text-sm font-semibold text-rojo">{error}</p>}
    </section>
  );
}
