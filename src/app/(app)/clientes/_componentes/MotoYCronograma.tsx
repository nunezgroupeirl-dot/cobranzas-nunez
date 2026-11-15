"use client";
import { Campo, OpcionesBoton, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import { TIPOS_MOTO } from "@/lib/placa";
import { fechaCuota } from "@/lib/supabase/reglas";
import type { Frecuencia } from "@/types/database";
import { CampoPlaca } from "../../contratos/_componentes/CampoPlaca";
import type { Venta } from "./venta";

const FRECUENCIAS: { valor: Frecuencia; texto: string }[] = [
  { valor: "semanal", texto: "Semanal" },
  { valor: "quincenal", texto: "Quincenal" },
  { valor: "mensual", texto: "Mensual" },
];

interface Props {
  activa: boolean;
  alActivar: (v: boolean) => void;
  v: Venta;
  errores: Record<string, string>;
  alCambiar: (cambio: Partial<Venta>) => void;
}

/**
 * Cliente nuevo: su moto (placa) y su cronograma de pagos, sin necesidad de tener el contrato todavía.
 * El contrato en papel se llena después y queda pendiente en "Datos pendientes → Contratos".
 */
export function MotoYCronograma({ activa, alActivar, v, errores, alCambiar }: Props) {
  const cuota = Number(v.cuota);
  const nro = Number(v.nro_cuotas);
  const listo = cuota > 0 && nro > 0 && v.fecha_inicio;
  return (
    <Tarjeta titulo="Moto y cronograma de pagos">
      <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
        <input type="checkbox" checked={activa} onChange={(e) => alActivar(e.target.checked)} className="size-5 shrink-0 accent-marca" />
        Registrar ya su moto y su cronograma (aunque todavía no tenga el contrato firmado)
      </label>
      {activa && (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-bold tracking-wide text-tenue uppercase">La moto</h3>
            <OpcionesBoton etiqueta="Tipo" opciones={TIPOS_MOTO.map((t) => ({ valor: t, texto: t }))} valor={v.tipo} alCambiar={(t) => alCambiar({ tipo: t })} obligatorio />
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoPlaca
                placa={v.placa}
                tramite={v.tramite}
                error={errores.placa}
                alCambiarPlaca={(placa) => alCambiar({ placa })}
                alCambiarTramite={(tramite) => alCambiar({ tramite })}
              />
              <Campo etiqueta="Marca" value={v.marca} onChange={(e) => alCambiar({ marca: e.target.value })} error={errores.marca} obligatorio list="marcas-moto-cliente" />
              <Campo etiqueta="Color" value={v.color} onChange={(e) => alCambiar({ color: e.target.value })} />
              <datalist id="marcas-moto-cliente">
                {["Honda", "Bajaj", "Yamaha", "TVS", "Suzuki", "Ronco", "Wanxin", "Lifan"].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-bold tracking-wide text-tenue uppercase">Cronograma de pagos</h3>
            <OpcionesBoton etiqueta="Frecuencia" opciones={FRECUENCIAS} valor={v.frecuencia} alCambiar={(f) => alCambiar({ frecuencia: f as Frecuencia })} obligatorio />
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo
                etiqueta="Cuota (S/)"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={v.cuota}
                onChange={(e) => alCambiar({ cuota: e.target.value })}
                error={errores.cuota}
                obligatorio
                className="num font-semibold"
              />
              <Campo
                etiqueta="N.º de cuotas"
                type="number"
                inputMode="numeric"
                min="1"
                max="260"
                value={v.nro_cuotas}
                onChange={(e) => alCambiar({ nro_cuotas: e.target.value })}
                error={errores.nro_cuotas}
                obligatorio
                className="num"
              />
              <Campo
                etiqueta="Fecha de la 1.ª cuota"
                type="date"
                value={v.fecha_inicio}
                onChange={(e) => alCambiar({ fecha_inicio: e.target.value })}
                error={errores.fecha_inicio}
                obligatorio
              />
              <Campo
                etiqueta="Precio total (S/)"
                type="number"
                inputMode="decimal"
                min="0"
                value={v.precio}
                onChange={(e) => alCambiar({ precio: e.target.value })}
                ayuda="Opcional"
                className="num"
              />
              <Campo
                etiqueta="Inicial (S/)"
                type="number"
                inputMode="decimal"
                min="0"
                value={v.inicial}
                onChange={(e) => alCambiar({ inicial: e.target.value })}
                ayuda="Opcional"
                className="num"
              />
              <Campo
                etiqueta="Cuotas que ya pagó"
                type="number"
                inputMode="numeric"
                min="0"
                value={v.pagadas}
                onChange={(e) => alCambiar({ pagadas: e.target.value })}
                error={errores.pagadas}
                ayuda="Si ya venía pagando. Luego puedes subir el voucher de cada una."
                className="num"
              />
            </div>
            {listo && (
              <p className="rounded-xl bg-marca-suave px-3 py-2 text-sm font-medium">
                {nro} cuotas {v.frecuencia === "semanal" ? "semanales" : v.frecuencia === "quincenal" ? "quincenales" : "mensuales"} de{" "}
                <b className="num">{formatoSoles(cuota)}</b>: del {formatoFecha(v.fecha_inicio)} al {formatoFecha(fechaCuota(v.fecha_inicio, nro - 1, v.frecuencia))}. Total{" "}
                <b className="num">{formatoSoles(cuota * nro)}</b>.
              </p>
            )}
          </section>
          <p className="text-sm text-tenue">
            El contrato en papel se llena después: este cliente saldrá en <b>Datos pendientes → Contratos</b> hasta que lo llenes, lo imprimas y subas el firmado.
          </p>
        </div>
      )}
      {!activa && <p className="text-sm text-tenue">Sin moto ni cronograma por ahora: podrás registrarlos después desde su ficha.</p>}
    </Tarjeta>
  );
}

