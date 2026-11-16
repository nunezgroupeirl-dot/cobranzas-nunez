"use client";
import { Campo, FRECUENCIAS, OpcionesBoton, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import { TIPOS_MOTO } from "@/lib/placa";
import { fechaCuota } from "@/lib/supabase/reglas";
import type { Frecuencia } from "@/types/database";
import { CampoPlaca } from "../../contratos/_componentes/CampoPlaca";
import type { Venta } from "./venta";

const OPCIONES_FRECUENCIA = FRECUENCIAS.map(({ valor, texto }) => ({ valor, texto }));
const MARCAS = ["Honda", "Bajaj", "Yamaha", "TVS", "Suzuki", "Ronco", "Wanxin", "Lifan"];

interface Props {
  /** null = ya tiene contrato: la sección siempre está activa (sin casilla) */
  activa: boolean | null;
  alActivar: (v: boolean) => void;
  v: Venta;
  errores: Record<string, string>;
  alCambiar: (cambio: Partial<Venta>) => void;
  /** editando un vehículo que ya tiene cronograma */
  conContrato: boolean;
  /** "Vehículo", "Vehículo 2"… */
  titulo: string;
  /** para quitar un vehículo nuevo que se agregó de más */
  alQuitar?: () => void;
}

/**
 * La moto (placa) y el cronograma de pagos del cliente, en dos tarjetas.
 * Sirve al crear y al editar; el contrato en papel se llena aparte.
 */
export function MotoYCronograma({ activa, alActivar, v, errores, alCambiar, conContrato, titulo, alQuitar }: Props) {
  const visible = activa !== false;
  const id = titulo.replace(/\W+/g, "-").toLowerCase();
  return (
    <>
      <Tarjeta
        titulo={titulo}
        accion={
          alQuitar && (
            <button type="button" onClick={alQuitar} className="text-sm font-semibold text-rojo">
              Quitar este vehículo
            </button>
          )
        }
      >
        {activa !== null && (
          <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={activa} onChange={(e) => alActivar(e.target.checked)} className="size-5 shrink-0 accent-marca" />
            Registrar ya su vehículo y su cronograma de pagos (aunque todavía no tenga el contrato firmado)
          </label>
        )}
        {visible ? (
          <div className="flex flex-col gap-4">
            <OpcionesBoton etiqueta="Tipo" opciones={TIPOS_MOTO.map((t) => ({ valor: t, texto: t }))} valor={v.tipo} alCambiar={(t) => alCambiar({ tipo: t })} obligatorio />
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoPlaca
                placa={v.placa}
                tramite={v.tramite}
                error={errores.placa}
                alCambiarPlaca={(placa) => alCambiar({ placa })}
                alCambiarTramite={(tramite) => alCambiar({ tramite })}
              />
              <Campo etiqueta="Marca" value={v.marca} onChange={(e) => alCambiar({ marca: e.target.value })} error={errores.marca} obligatorio list={`marcas-${id}`} />
              <Campo etiqueta="Color" value={v.color} onChange={(e) => alCambiar({ color: e.target.value })} />
              <datalist id={`marcas-${id}`}>
                {MARCAS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>
        ) : (
          <p className="text-sm text-tenue">Sin vehículo ni cronograma por ahora: podrás registrarlos después.</p>
        )}
      </Tarjeta>

      {visible && (
        <Tarjeta titulo={`Cronograma de pagos${titulo === "Vehículo" ? "" : ` · ${titulo}`}`}>
          <CamposCronograma v={v} errores={errores} alCambiar={alCambiar} />
          <p className="mt-4 text-sm text-tenue">
            {conContrato
              ? "Si cambias la cuota, el número de cuotas, la fecha o la frecuencia, el cronograma se vuelve a armar y los pagos ya registrados se aplican de nuevo."
              : "El contrato en papel se llena después: el cliente saldrá en Datos pendientes → Contratos hasta que lo llenes, lo imprimas y subas el firmado."}
          </p>
        </Tarjeta>
      )}
    </>
  );
}

function CamposCronograma({ v, errores, alCambiar }: Pick<Props, "v" | "errores" | "alCambiar">) {
  const cuota = Number(v.cuota);
  const nro = Number(v.nro_cuotas);
  const plural = FRECUENCIAS.find((f) => f.valor === v.frecuencia)?.plural ?? "";
  return (
    <div className="flex flex-col gap-4">
      <OpcionesBoton etiqueta="Cobro" opciones={OPCIONES_FRECUENCIA} valor={v.frecuencia} alCambiar={(f) => alCambiar({ frecuencia: f as Frecuencia })} obligatorio />
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
          max="1000"
          value={v.nro_cuotas}
          onChange={(e) => alCambiar({ nro_cuotas: e.target.value })}
          error={errores.nro_cuotas}
          obligatorio
          className="num"
        />
        <Campo etiqueta="Fecha de la 1.ª cuota" type="date" value={v.fecha_inicio} onChange={(e) => alCambiar({ fecha_inicio: e.target.value })} error={errores.fecha_inicio} obligatorio />
        <Campo etiqueta="Precio total (S/)" type="number" inputMode="decimal" min="0" value={v.precio} onChange={(e) => alCambiar({ precio: e.target.value })} ayuda="Opcional" className="num" />
        <Campo etiqueta="Inicial (S/)" type="number" inputMode="decimal" min="0" value={v.inicial} onChange={(e) => alCambiar({ inicial: e.target.value })} ayuda="Opcional" className="num" />
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
      {cuota > 0 && nro > 0 && v.fecha_inicio && (
        <p className="rounded-xl bg-marca-suave px-3 py-2 text-sm font-medium">
          {nro} cuotas {plural} de <b className="num">{formatoSoles(cuota)}</b>: del {formatoFecha(v.fecha_inicio)} al{" "}
          {formatoFecha(fechaCuota(v.fecha_inicio, nro - 1, v.frecuencia))}. Total <b className="num">{formatoSoles(cuota * nro)}</b>.
        </p>
      )}
    </div>
  );
}
