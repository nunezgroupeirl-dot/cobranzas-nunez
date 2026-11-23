"use client";
import type { ReactNode } from "react";
import { Campo, FRECUENCIAS, OpcionesBoton, Selector, Tarjeta, diaSemana, fechaLarga, formatoSoles } from "@/components/ui";
import { TIPOS_MOTO } from "@/lib/placa";
import { fechaCuota } from "@/lib/supabase/reglas";
import type { Frecuencia } from "@/types/database";
import { CampoPlaca } from "../../contratos/_componentes/CampoPlaca";
import { VehiculosExtra } from "./VehiculosExtra";
import {
  CAPITAL_MINIMO,
  CAPITAL_TOPE,
  GPS_MES_DEFECTO,
  calcularConInteres,
  cuotasDelPlazo,
  interesPorDefecto,
  tramoDe,
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
  /** empresas para elegir la de este vehículo; si no se elige, va la del cliente */
  empresas: { valor: string; texto: string }[];
  empresaCliente: string;
  /** las fotos de este vehículo (4 lados y tarjeta de propiedad) */
  fotos?: ReactNode;
  /** comprobantes de las cuotas que ya venía pagando (van justo debajo de "cuotas pagadas") */
  comprobantes?: ReactNode;
}

/**
 * La moto (placa) y el cronograma de pagos del cliente, en dos tarjetas.
 * Sirve al crear y al editar; el contrato en papel se llena aparte.
 */
export function MotoYCronograma({ activa, alActivar, v, errores, alCambiar, conContrato, titulo, alQuitar, empresas, empresaCliente, fotos, comprobantes }: Props) {
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
            <Selector
              etiqueta="Empresa del vehículo"
              opciones={empresas}
              value={v.empresa_id || empresaCliente}
              onChange={(e) => alCambiar({ empresa_id: e.target.value })}
              ayuda={
                conContrato
                  ? "Su contrato y sus pagos van a esta empresa. Si ya tiene pagos registrados, no se puede cambiar."
                  : "Su contrato y sus pagos van a esta empresa (por defecto, la del cliente)."
              }
              className="sm:max-w-md"
              obligatorio
            />
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
            <VehiculosExtra v={v} alCambiar={alCambiar} error={errores.extras} />
            {fotos}
          </div>
        ) : (
          <p className="text-sm text-tenue">Sin vehículo ni cronograma por ahora: podrás registrarlos después.</p>
        )}
      </Tarjeta>

      {visible && (
        <Tarjeta titulo={`Cronograma de pagos${titulo === "Vehículo" ? "" : ` · ${titulo}`}`}>
          <CamposCronograma v={v} errores={errores} alCambiar={alCambiar} comprobantes={comprobantes} />
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

function CamposCronograma({ v, errores, alCambiar, comprobantes }: Pick<Props, "v" | "errores" | "alCambiar" | "comprobantes">) {
  const cuota = Number(v.cuota);
  const nro = Number(v.nro_cuotas);
  const plural = FRECUENCIAS.find((f) => f.valor === v.frecuencia)?.plural ?? "";
  const calculo = v.usar_capital ? calcularConInteres(v) : null;
  const tramo = tramoDe(v.capital);
  // con el botón prendido, al cambiar el capital, el interés, el GPS, el n.º de cuotas o la frecuencia,
  // el precio total y la cuota se calculan solos; los dos se pueden corregir a mano
  const conCalculo = (cambio: Partial<Venta>) => {
    const x = { ...v, ...cambio };
    if (!x.usar_capital) {
      // sin capital e interés: el precio total se llena solo con cuota × n.º de cuotas (se puede corregir a mano)
      const c = Number(x.cuota);
      const n = Number(x.nro_cuotas);
      const automatico = ("cuota" in cambio || "nro_cuotas" in cambio) && c > 0 && Number.isInteger(n) && n > 0;
      alCambiar(automatico ? { ...cambio, precio: (Math.round(c * n * 100) / 100).toFixed(2) } : cambio);
      return;
    }
    // la cuota la pueden corregir a mano: se respeta tal cual y el precio total pasa a ser cuota × n.º de cuotas
    if ("cuota" in cambio) {
      const c = Number(x.cuota);
      const n = Number(x.nro_cuotas);
      alCambiar(c > 0 && Number.isInteger(n) && n > 0 ? { ...cambio, precio: (Math.round(c * n * 100) / 100).toFixed(2) } : cambio);
      return;
    }
    // al cambiar el capital, el interés vuelve al automático de su tramo (S/ 500 por mes o 50 % al año)
    if ("capital" in cambio) x.interes = x.capital.trim() ? interesPorDefecto(x.capital) : "";
    const r = calcularConInteres(x);
    // al cambiar el plazo o el capital, lo que depende de ellos se rehace; si falta un dato, se limpia
    const cambioBase = "capital" in cambio || "nro_cuotas" in cambio;
    alCambiar(
      r
        ? { ...cambio, interes: x.interes, precio: r.total.toFixed(2), cuota: r.cuota.toFixed(2) }
        : { ...cambio, interes: x.interes, ...(cambioBase ? { precio: "", cuota: "" } : {}) },
    );
  };
  // el plazo se piensa en meses: llena el n.º de cuotas según la frecuencia (semanal: 1 mes = 4, 2 = 9 … 12 = 52; diario: 30 por mes)
  const cambiarMeses = (texto: string) => {
    const meses = Number(texto);
    // sin plazo válido se limpian el n.º de cuotas, el precio total y la cuota
    conCalculo({ nro_cuotas: Number.isInteger(meses) && meses > 0 && meses <= 120 ? String(cuotasDelPlazo(meses, v.frecuencia)) : "" });
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
            // al prenderlo, el GPS viene marcado (hay vehículo); en un préstamo sin vehículo se desmarca
            onChange={(e) => conCalculo({ usar_capital: e.target.checked, gps: e.target.checked && !v.gps ? GPS_MES_DEFECTO : v.gps })}
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
                  ? `Más de ${formatoSoles(CAPITAL_TOPE)}: 50 % al año (a 12 meses se calcula por día). Se puede cambiar.`
                  : tramo === "bajo"
                    ? `Menos de ${formatoSoles(CAPITAL_MINIMO)}: 20 % del capital por mes. Se puede cambiar.`
                    : `De ${formatoSoles(CAPITAL_MINIMO)} a ${formatoSoles(CAPITAL_TOPE)}: S/ 500 por mes (+ S/ 3 de GPS = 503). Se puede cambiar.`
              }
              className="num"
            />
            {v.frecuencia === "diario" || calculo?.porDia ? (
              <p className="self-center text-sm text-tenue">
                El GPS va en los días de más: la cuota sale de 30 días por mes y se cobran 364 días al año.
              </p>
            ) : (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={v.gps.trim() !== ""}
                  onChange={(e) => conCalculo({ gps: e.target.checked ? GPS_MES_DEFECTO : "" })}
                  className="size-5 accent-marca"
                />
                Sumar GPS (S/ 3 por mes)
              </label>
              <p className="-mt-1 text-xs text-tenue">Con vehículo sí; si es préstamo sin vehículo, desmárcalo.</p>
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
                  {calculo.porDia ? (
                    <span>
                      Capital + {v.interes} %: <b className="num">{formatoSoles(calculo.calculado)}</b> ÷ 12 ÷ 30 ={" "}
                      <b className="num">{formatoSoles(calculo.diaria)} al día</b>
                    </span>
                  ) : (
                    <>
                      <span>
                        Interés: <b className="num">{formatoSoles(calculo.interesMes)}</b> por mes × {calculo.meses.toLocaleString("es-PE")} ={" "}
                        <b className="num">{formatoSoles(calculo.interesSoles)}</b>
                      </span>
                      {calculo.gpsSoles > 0 && (
                        <span>
                          GPS{calculo.diasGps ? ` (${calculo.diasGps} días de más)` : ""}: <b className="num">{formatoSoles(calculo.gpsSoles)}</b>
                        </span>
                      )}
                      <span>
                        Suma: <b className="num">{formatoSoles(calculo.calculado)}</b>
                      </span>
                    </>
                  )}
                  <span className="basis-full text-base">
                    Cuota <b className="num">{formatoSoles(calculo.cuota)}</b> × {v.nro_cuotas} = Precio total{" "}
                    <b className="num text-marca">{formatoSoles(calculo.total)}</b>
                    {Math.abs(calculo.total - calculo.calculado) >= 0.01 && <span className="text-tenue"> (la cuota se redondea hacia arriba al décimo; puedes corregirla a mano)</span>}
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
          onChange={(e) => conCalculo({ cuota: e.target.value })}
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
            ayuda={calculo ? "Capital + interés (+ GPS). Si lo cambias, la cuota se recalcula." : "Se llena solo: cuota × n.º de cuotas. Si lo cambias, la cuota se recalcula."}
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
          ayuda="Si ya venía pagando: abajo se sube el comprobante de esas cuotas (obligatorio)."
          className="num"
        />
      </div>
      {comprobantes}
      {cuota > 0 && nro > 0 && v.fecha_inicio && (
        <p className="rounded-xl bg-marca-suave px-3 py-2 text-sm font-medium">
          {nro} cuotas {plural} de <b className="num">{formatoSoles(cuota)}</b>: del {fechaLarga(v.fecha_inicio)} al{" "}
          {fechaLarga(fechaCuota(v.fecha_inicio, nro - 1, v.frecuencia))}. Total <b className="num">{formatoSoles(totalCuotas)}</b>.
          {v.frecuencia === "semanal" && (
            <span className="mt-1 block text-lg font-extrabold text-marca uppercase">Paga todos los {diaSemana(v.fecha_inicio)}</span>
          )}
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
