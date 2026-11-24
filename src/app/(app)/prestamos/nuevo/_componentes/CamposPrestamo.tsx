"use client";
import { Campo, FRECUENCIAS, OpcionesBoton, diaSemana, fechaLarga, formatoSoles } from "@/components/ui";
import { fechaCuota } from "@/lib/supabase/reglas";
import type { Frecuencia } from "@/types/database";
import {
  CAPITAL_MINIMO,
  CAPITAL_TOPE,
  GPS_MES_DEFECTO,
  calcularConInteres,
  cuotasDelPlazo,
  interesPorDefecto,
  tramoDe,
} from "../../../clientes/_componentes/venta";
import type { Prestamo } from "./prestamo";

const OPCIONES_FRECUENCIA = FRECUENCIAS.map(({ valor, texto }) => ({ valor, texto }));

interface Props {
  v: Prestamo;
  errores: Record<string, string>;
  alCambiar: (cambio: Partial<Prestamo>) => void;
}

/** Monto, interés, plazo y cuotas de un préstamo de dinero. Mismo cálculo que una venta, sin vehículo. */
export function CamposPrestamo({ v, errores, alCambiar }: Props) {
  const cuota = Number(v.cuota);
  const nro = Number(v.nro_cuotas);
  const plural = FRECUENCIAS.find((f) => f.valor === v.frecuencia)?.plural ?? "";
  const calculo = v.usar_capital ? calcularConInteres(v) : null;
  const tramo = tramoDe(v.capital);

  // con el cálculo activo, al cambiar el capital, el interés, el GPS, el n.º de cuotas o la frecuencia,
  // el precio total y la cuota se calculan solos; los dos se pueden corregir a mano.
  const conCalculo = (cambio: Partial<Prestamo>) => {
    const x = { ...v, ...cambio };
    if (!x.usar_capital) {
      const c = Number(x.cuota);
      const n = Number(x.nro_cuotas);
      const automatico = ("cuota" in cambio || "nro_cuotas" in cambio) && c > 0 && Number.isInteger(n) && n > 0;
      alCambiar(automatico ? { ...cambio, precio: (Math.round(c * n * 100) / 100).toFixed(2) } : cambio);
      return;
    }
    if ("cuota" in cambio) {
      const c = Number(x.cuota);
      const n = Number(x.nro_cuotas);
      alCambiar(c > 0 && Number.isInteger(n) && n > 0 ? { ...cambio, precio: (Math.round(c * n * 100) / 100).toFixed(2) } : cambio);
      return;
    }
    if ("capital" in cambio) x.interes = x.capital.trim() ? interesPorDefecto(x.capital) : "";
    const r = calcularConInteres(x);
    const cambioBase = "capital" in cambio || "nro_cuotas" in cambio;
    alCambiar(r ? { ...cambio, interes: x.interes, precio: r.total.toFixed(2), cuota: r.cuota.toFixed(2) } : { ...cambio, interes: x.interes, ...(cambioBase ? { precio: "", cuota: "" } : {}) });
  };
  // el plazo se piensa en meses: llena el n.º de cuotas según la frecuencia
  const cambiarMeses = (texto: string) => {
    const meses = Number(texto);
    conCalculo({ nro_cuotas: Number.isInteger(meses) && meses > 0 && meses <= 120 ? String(cuotasDelPlazo(meses, v.frecuencia)) : "" });
  };
  const cambiarPrecio = (precio: string) => {
    const n = Number(v.nro_cuotas);
    alCambiar(Number(precio) > 0 && Number.isInteger(n) && n > 0 ? { precio, cuota: (Math.round((Number(precio) / n) * 100) / 100).toFixed(2) } : { precio });
  };
  const totalCuotas = Math.round(cuota * nro * 100) / 100;

  return (
    <div className="flex flex-col gap-4">
      <OpcionesBoton etiqueta="Cobro" opciones={OPCIONES_FRECUENCIA} valor={v.frecuencia} alCambiar={(f) => conCalculo({ frecuencia: f as Frecuencia })} obligatorio />
      <div className="rounded-xl border border-borde bg-fondo p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={v.usar_capital} onChange={(e) => conCalculo({ usar_capital: e.target.checked })} className="size-5 shrink-0 accent-marca" />
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
              ayuda="Lo que se le prestó en efectivo."
              className="num"
            />
            <Campo
              etiqueta={tramo === "alto" ? "Interés al año (%)" : tramo === "bajo" ? "Interés por mes (%)" : "Interés por mes (S/)"}
              type="number"
              inputMode="decimal"
              min="0"
              max={tramo === "medio" ? undefined : "500"}
              step="0.01"
              value={v.interes}
              onChange={(e) => conCalculo({ interes: e.target.value })}
              error={errores.interes}
              ayuda={
                tramo === "alto"
                  ? `Más de ${formatoSoles(CAPITAL_TOPE)}: 50 % al año. Se puede cambiar.`
                  : tramo === "bajo"
                    ? `Menos de ${formatoSoles(CAPITAL_MINIMO)}: 20 % del capital por mes. Se puede cambiar.`
                    : `De ${formatoSoles(CAPITAL_MINIMO)} a ${formatoSoles(CAPITAL_TOPE)}: S/ 500 por mes. Se puede cambiar.`
              }
              className="num"
            />
            {v.frecuencia === "diario" || calculo?.porDia ? (
              <p className="self-center text-sm text-tenue">La cuota sale de 30 días por mes y se cobran 364 días al año.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={v.gps.trim() !== ""} onChange={(e) => conCalculo({ gps: e.target.checked ? GPS_MES_DEFECTO : "" })} className="size-5 accent-marca" />
                  Sumar GPS (S/ 3 por mes)
                </label>
                <p className="-mt-1 text-xs text-tenue">Un préstamo normalmente no lleva GPS.</p>
                {v.gps.trim() !== "" && (
                  <Campo etiqueta="GPS por mes (S/)" type="number" inputMode="decimal" min="0" step="0.01" value={v.gps} onChange={(e) => conCalculo({ gps: e.target.value })} error={errores.gps} className="num" />
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
                  {calculo.porDia ? (
                    <span>
                      Capital + {v.interes} %: <b className="num">{formatoSoles(calculo.calculado)}</b> ÷ 12 ÷ 30 = <b className="num">{formatoSoles(calculo.diaria)} al día</b>
                    </span>
                  ) : (
                    <>
                      <span>
                        Interés: <b className="num">{formatoSoles(calculo.interesMes)}</b> por mes × {calculo.meses.toLocaleString("es-PE")} = <b className="num">{formatoSoles(calculo.interesSoles)}</b>
                      </span>
                      {calculo.gpsSoles > 0 && (
                        <span>
                          GPS: <b className="num">{formatoSoles(calculo.gpsSoles)}</b>
                        </span>
                      )}
                      <span>
                        Suma: <b className="num">{formatoSoles(calculo.calculado)}</b>
                      </span>
                    </>
                  )}
                  <span className="basis-full text-base">
                    Cuota <b className="num">{formatoSoles(calculo.cuota)}</b> × {v.nro_cuotas} = Total a cobrar <b className="num text-marca">{formatoSoles(calculo.total)}</b>
                    {Math.abs(calculo.total - calculo.calculado) >= 0.01 && <span className="text-tenue"> (la cuota se redondea hacia arriba al décimo; puedes corregirla a mano)</span>}
                  </span>
                </span>
              ) : (
                <span className="text-tenue">Escribe el plazo y el capital: el total y la cuota se calculan solos.</span>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Cuota (S/)" type="number" inputMode="decimal" min="0" step="0.01" value={v.cuota} onChange={(e) => conCalculo({ cuota: e.target.value })} error={errores.cuota} obligatorio className="num font-semibold" />
        <Campo etiqueta="N.º de cuotas" type="number" inputMode="numeric" min="1" max="1000" value={v.nro_cuotas} onChange={(e) => conCalculo({ nro_cuotas: e.target.value })} error={errores.nro_cuotas} obligatorio className="num" />
        <Campo etiqueta="Fecha de la 1.ª cuota" type="date" value={v.fecha_inicio} onChange={(e) => alCambiar({ fecha_inicio: e.target.value })} error={errores.fecha_inicio} obligatorio />
        <Campo
          etiqueta="Total a cobrar (S/)"
          type="number"
          inputMode="decimal"
          min="0"
          value={v.precio}
          onChange={(e) => cambiarPrecio(e.target.value)}
          ayuda={calculo ? "Capital + interés. Si lo cambias, la cuota se recalcula." : "Se llena solo: cuota × n.º de cuotas."}
          className="num"
        />
        <Campo etiqueta="Entregó de inicial (S/)" type="number" inputMode="decimal" min="0" value={v.inicial} onChange={(e) => alCambiar({ inicial: e.target.value })} ayuda="Opcional" className="num" />
      </div>
      {cuota > 0 && nro > 0 && v.fecha_inicio && (
        <p className="rounded-xl bg-marca-suave px-3 py-2 text-sm font-medium">
          {nro} cuotas {plural} de <b className="num">{formatoSoles(cuota)}</b>: del {fechaLarga(v.fecha_inicio)} al {fechaLarga(fechaCuota(v.fecha_inicio, nro - 1, v.frecuencia))}. Total{" "}
          <b className="num">{formatoSoles(totalCuotas)}</b>.
          {v.frecuencia === "semanal" && <span className="mt-1 block text-lg font-extrabold text-marca uppercase">Paga todos los {diaSemana(v.fecha_inicio)}</span>}
        </p>
      )}
    </div>
  );
}
