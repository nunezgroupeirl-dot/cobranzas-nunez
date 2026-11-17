"use client";
import { Campo, FRECUENCIAS, OpcionesBoton, Tarjeta, formatoFecha, formatoSoles } from "@/components/ui";
import { TIPOS_MOTO } from "@/lib/placa";
import { fechaCuota } from "@/lib/supabase/reglas";
import type { Frecuencia } from "@/types/database";
import { CampoPlaca } from "../../contratos/_componentes/CampoPlaca";
import {
  CAPITAL_TOPE,
  GPS_MES_DEFECTO,
  INTERES_MES_PCT_SUGERIDO,
  INTERES_PCT_DEFECTO,
  calcularConInteres,
  cuotasDelPlazo,
  interesEnPorcentaje,
  interesMesSugerido,
  type Venta,
} from "./venta";

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
  const calculo = v.usar_capital ? calcularConInteres(v) : null;
  const enPorcentaje = interesEnPorcentaje(v.capital);
  // con el botón prendido, al cambiar el capital, el interés, el GPS, el n.º de cuotas o la frecuencia,
  // el precio total y la cuota se calculan solos; los dos se pueden corregir a mano
  const conCalculo = (cambio: Partial<Venta>) => {
    const x = { ...v, ...cambio };
    if (!x.usar_capital) {
      alCambiar(cambio);
      return;
    }
    if ("capital" in cambio && x.capital.trim()) {
      const cambiaTramo = interesEnPorcentaje(x.capital) !== interesEnPorcentaje(v.capital);
      // hasta S/ 12 000: si el interés estaba vacío o era el sugerido, sigue al capital (20 % por mes)
      const eraSugerido = !v.interes.trim() || (!interesEnPorcentaje(v.capital) && v.interes === interesMesSugerido(v.capital));
      if (cambiaTramo || eraSugerido) x.interes = interesEnPorcentaje(x.capital) ? INTERES_PCT_DEFECTO : interesMesSugerido(x.capital);
    }
    const r = calcularConInteres(x);
    alCambiar(r ? { ...cambio, interes: x.interes, precio: r.total.toFixed(2), cuota: r.cuota.toFixed(2) } : { ...cambio, interes: x.interes });
  };
  // el plazo se piensa en meses: llena el n.º de cuotas según la frecuencia (semanal: 1 mes = 4, 2 = 9 … 12 = 52; diario: 30 por mes)
  const cambiarMeses = (texto: string) => {
    const meses = Number(texto);
    if (Number.isInteger(meses) && meses > 0 && meses <= 120) conCalculo({ nro_cuotas: String(cuotasDelPlazo(meses, v.frecuencia)) });
  };
  // si corrigen el precio total a mano, la cuota sale de ese precio
  const cambiarPrecio = (precio: string) => {
    const n = Number(v.nro_cuotas);
    alCambiar(Number(precio) > 0 && Number.isInteger(n) && n > 0 ? { precio, cuota: (Math.round((Number(precio) / n) * 100) / 100).toFixed(2) } : { precio });
  };
  const totalCuotas = Math.round(cuota * nro * 100) / 100;
  const precio = Number(v.precio);
  // lo que vale es cuota × n.º de cuotas (es lo que se cobra y se imprime); si no cuadra con el precio total, se avisa
  const descuadre = precio > 0 && cuota > 0 && nro > 0 ? Math.round((totalCuotas - precio) * 100) / 100 : 0;
  return (
    <div className="flex flex-col gap-4">
      <OpcionesBoton etiqueta="Cobro" opciones={OPCIONES_FRECUENCIA} valor={v.frecuencia} alCambiar={(f) => conCalculo({ frecuencia: f as Frecuencia })} obligatorio />
      <div className="rounded-xl border border-borde bg-fondo p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={v.usar_capital}
            onChange={(e) => alCambiar({ usar_capital: e.target.checked })}
            className="size-5 shrink-0 accent-marca"
          />
          <span className="text-sm font-semibold">
            Calcular con capital e interés <span className="font-normal text-tenue">· solo lo ven los administradores; el cliente no</span>
          </span>
        </label>
        {!v.usar_capital && <p className="mt-1 ml-8 text-sm text-tenue">Apagado: la cuota y el n.º de cuotas se ponen a mano.</p>}
        {v.usar_capital && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              etiqueta="Plazo (meses)"
              type="number"
              inputMode="numeric"
              min="1"
              max="120"
              defaultValue={calculo && Number.isInteger(calculo.meses) ? calculo.meses : undefined}
              key={v.frecuencia}
              onChange={(e) => cambiarMeses(e.target.value)}
              ayuda="Llena solo el n.º de cuotas (semanal: 1 mes = 4 … 12 = 52; diario: 12 meses = 364 días)."
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
              etiqueta={enPorcentaje ? "Interés al año (%)" : "Interés por mes (S/)"}
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
                  ? `Desde ${formatoSoles(CAPITAL_TOPE + 1)}: ${INTERES_PCT_DEFECTO} % al año, proporcional al plazo (se puede cambiar).`
                  : `Hasta ${formatoSoles(CAPITAL_TOPE)}: soles por mes × meses. Sugerido: ${INTERES_MES_PCT_SUGERIDO} % del capital (se puede cambiar).`
              }
              className="num"
            />
            {v.frecuencia === "diario" ? (
              <p className="self-center text-sm text-tenue">En diario el GPS son los días de más: la cuota sale de 30 días por mes y se cobran 364 días al año.</p>
            ) : (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={v.gps.trim() !== ""}
                  onChange={(e) => conCalculo({ gps: e.target.checked ? GPS_MES_DEFECTO : "" })}
                  className="size-5 accent-marca"
                />
                Sumar GPS
              </label>
              {v.gps.trim() !== "" && (
                <Campo
                  etiqueta="GPS por mes (S/)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={v.gps}
                  onChange={(e) => conCalculo({ gps: e.target.value })}
                  error={errores.gps}
                  className="num"
                />
              )}
            </div>
            )}
            <div className="flex flex-col justify-center rounded-xl bg-superficie px-3 py-2 text-sm sm:col-span-2 lg:col-span-4">
              {calculo ? (
                <span className="flex flex-wrap gap-x-5 gap-y-1">
                  <span>
                    Plazo: <b className="num">{calculo.meses.toLocaleString("es-PE")} meses</b>
                  </span>
                  <span>
                    Capital: <b className="num">{formatoSoles(Number(v.capital))}</b>
                  </span>
                  <span>
                    Interés: <b className="num">{formatoSoles(calculo.interesSoles)}</b>
                  </span>
                  {calculo.gpsSoles > 0 && (
                    <span>
                      GPS{calculo.diasGps ? ` (${calculo.diasGps} días de más)` : ""}: <b className="num">{formatoSoles(calculo.gpsSoles)}</b>
                    </span>
                  )}
                  <span>
                    Precio total: <b className="num">{formatoSoles(calculo.total)}</b>
                  </span>
                </span>
              ) : (
                <span className="text-tenue">Escribe el plazo y el capital: el precio total y la cuota se calculan solos.</span>
              )}
            </div>
          </div>
        )}
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
        <div className="flex flex-col gap-4">
          <Campo
            etiqueta="Precio total (S/)"
            type="number"
            inputMode="decimal"
            min="0"
            value={v.precio}
            onChange={(e) => cambiarPrecio(e.target.value)}
            ayuda={calculo ? "Capital + interés (+ GPS). Si lo cambias, la cuota se recalcula." : "Opcional"}
            className="num"
          />
          <Campo
            etiqueta="Fecha de entrega del vehículo"
            type="date"
            value={v.fecha_entrega}
            onChange={(e) => alCambiar({ fecha_entrega: e.target.value })}
            ayuda="El día que se le entrega el vehículo."
          />
        </div>
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
          {formatoFecha(fechaCuota(v.fecha_inicio, nro - 1, v.frecuencia))}. Total <b className="num">{formatoSoles(totalCuotas)}</b>.
          {descuadre !== 0 && (
            <span className="mt-1 block text-amarillo">
              Ojo: el total de las cuotas es {formatoSoles(Math.abs(descuadre))} {descuadre > 0 ? "más" : "menos"} que el precio total ({formatoSoles(precio)}). Lo que se cobra
              y se imprime es el total de las cuotas.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
