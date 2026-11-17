"use client";
import { Campo, FRECUENCIAS, OpcionesBoton, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import { TIPOS_MOTO } from "@/lib/placa";
import { fechaCuota } from "@/lib/supabase/reglas";
import type { Frecuencia } from "@/types/database";
import { CampoPlaca } from "../../contratos/_componentes/CampoPlaca";
import { CAPITAL_TOPE, INTERES_MES_DEFECTO, INTERES_PCT_DEFECTO, calcularConInteres, cuotasDelPlazo, interesEnPorcentaje, type Venta } from "./venta";

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
              <Campo etiqueta="Marca" value={v.marca} onChange={(e) => alCambiar({ marca: e.target.value })} error={errores.marca} obligatorio={!v.tramite} list={`marcas-${id}`} />
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
  const calculo = calcularConInteres(v);
  const enPorcentaje = interesEnPorcentaje(v.capital);
  // al cambiar el capital, el interés, el n.º de cuotas o la frecuencia, el precio total (capital + interés) y la cuota
  // se calculan solos; los dos se pueden corregir a mano
  const conCalculo = (cambio: Partial<Venta>) => {
    const x = { ...v, ...cambio };
    // al pasar de un tramo al otro (hasta o más de S/ 12 000), el interés toma el valor por defecto de ese tramo
    if ("capital" in cambio && (interesEnPorcentaje(x.capital) !== interesEnPorcentaje(v.capital) || !v.interes.trim()) && x.capital.trim())
      x.interes = interesEnPorcentaje(x.capital) ? INTERES_PCT_DEFECTO : INTERES_MES_DEFECTO;
    const r = calcularConInteres(x);
    alCambiar(r ? { ...cambio, interes: x.interes, precio: r.total.toFixed(2), cuota: r.cuota.toFixed(2) } : { ...cambio, interes: x.interes });
  };
  // el plazo se piensa en meses: llena el n.º de cuotas según la frecuencia (semanal: 1 mes = 4, 2 = 9 … 12 = 52)
  const cambiarMeses = (texto: string) => {
    const meses = Number(texto);
    if (Number.isInteger(meses) && meses > 0 && meses <= 120) conCalculo({ nro_cuotas: String(cuotasDelPlazo(meses, v.frecuencia)) });
  };
  // si corrigen el precio total a mano, la cuota sale de ese precio
  const cambiarPrecio = (precio: string) => {
    const n = Number(v.nro_cuotas);
    alCambiar(Number(precio) > 0 && Number.isInteger(n) && n > 0 ? { precio, cuota: (Math.round((Number(precio) / n) * 100) / 100).toFixed(2) } : { precio });
  };
  return (
    <div className="flex flex-col gap-4">
      <OpcionesBoton etiqueta="Cobro" opciones={OPCIONES_FRECUENCIA} valor={v.frecuencia} alCambiar={(f) => conCalculo({ frecuencia: f as Frecuencia })} obligatorio />
      <div className="rounded-xl border border-borde bg-fondo p-3">
        <p className="mb-2 text-sm font-semibold">
          Capital e interés <span className="font-normal text-tenue">· solo lo ven los administradores; el cliente no</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            etiqueta="Plazo (meses)"
            type="number"
            inputMode="numeric"
            min="1"
            max="120"
            defaultValue={calculo && Number.isInteger(calculo.meses) ? calculo.meses : undefined}
            key={v.frecuencia}
            onChange={(e) => cambiarMeses(e.target.value)}
            ayuda="Llena solo el n.º de cuotas (semanal: 1 mes = 4 … 12 meses = 52)."
            className="num"
          />
          <Campo
            etiqueta="Capital prestado (S/)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={v.capital}
            onChange={(e) => conCalculo({ capital: e.target.value })}
            error={errores.capital}
            ayuda="Lo que se le prestó para el vehículo."
            className="num"
          />
          <Campo
            etiqueta={enPorcentaje ? "Interés (%)" : "Interés por mes (S/)"}
            type="number"
            inputMode="decimal"
            min="0"
            max={enPorcentaje ? "500" : undefined}
            step="0.01"
            value={v.interes}
            onChange={(e) => conCalculo({ interes: e.target.value })}
            error={errores.interes}
            ayuda={
              enPorcentaje
                ? `Más de ${formatoSoles(CAPITAL_TOPE)}: ${INTERES_PCT_DEFECTO} % fijo del capital (se puede cambiar).`
                : `Hasta ${formatoSoles(CAPITAL_TOPE)}: soles por mes, se multiplica por los meses del contrato.`
            }
            className="num"
          />
          <div className="flex flex-col justify-center rounded-xl bg-superficie px-3 py-2 text-sm">
            {calculo ? (
              <>
                {!calculo.porcentaje && (
                  <span>
                    Plazo: <b className="num">{calculo.meses.toLocaleString("es-PE")} meses</b>
                  </span>
                )}
                <span>
                  Interés: <b className="num">{formatoSoles(calculo.interesSoles)}</b>
                </span>
                <span>
                  Precio total: <b className="num">{formatoSoles(calculo.total)}</b>
                </span>
              </>
            ) : (
              <span className="text-tenue">Escribe el capital y el n.º de cuotas: el precio total y la cuota se calculan solos.</span>
            )}
          </div>
        </div>
      </div>
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
          onChange={(e) => conCalculo({ nro_cuotas: e.target.value })}
          error={errores.nro_cuotas}
          obligatorio
          className="num"
        />
        <Campo etiqueta="Fecha de la 1.ª cuota" type="date" value={v.fecha_inicio} onChange={(e) => alCambiar({ fecha_inicio: e.target.value })} error={errores.fecha_inicio} obligatorio />
        <Campo
          etiqueta="Precio total (S/)"
          type="number"
          inputMode="decimal"
          min="0"
          value={v.precio}
          onChange={(e) => cambiarPrecio(e.target.value)}
          ayuda={calculo ? "Capital + interés. Si lo cambias, la cuota se recalcula." : "Opcional"}
          className="num"
        />
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
