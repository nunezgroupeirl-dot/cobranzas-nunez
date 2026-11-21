"use client";
import { opcionesDeCuenta, textoMedio } from "@/lib/cuentas";
import { useMemo, useRef, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import {
  Aviso,
  Boton,
  Campo,
  Modal,
  NOMBRE_MEDIO,
  OpcionesBoton,
  Selector,
  VistaPrevia,
  formatoFecha,
  formatoFechaHora,
  formatoSoles,
  hoyLima,
  mensajeDeError,
  useCarga,
} from "@/components/ui";
import { borrarFoto, prepararFotoPago } from "@/lib/fotos";
import { pagosPorCuota } from "@/lib/supabase/reglas";
import type { Contrato, Cuenta, Cuota, MedioPago, Pago } from "@/types/database";
import { Foto } from "../../clientes/_componentes/Foto";
import { Cronograma } from "./Cronograma";

export const OPCIONES_MEDIO = (Object.keys(NOMBRE_MEDIO) as MedioPago[]).map((m) => ({ valor: m, texto: NOMBRE_MEDIO[m] }));

/** Pagada según el cuaderno y todavía sin comprobante en el sistema. */
const sinComprobante = (c: Cuota, contrato: Contrato) => c.numero <= contrato.cuotas_pagadas_inicial && c.monto_pagado >= c.monto && !c.fecha_pago;

interface Props {
  contrato: Contrato;
  cuotas: Cuota[];
  alGuardar: () => void;
}

/**
 * Cronograma del contrato. Las cuotas con pago muestran su voucher al tocarlas.
 * El dueño, además, puede elegir las cuotas que el cuaderno ya daba por pagadas y subirles su voucher:
 * quedan como un pago normal (con su fecha, medio y foto) en el historial.
 */
export function CronogramaConComprobantes({ contrato, cuotas, alGuardar }: Props) {
  const { datos, esAdmin } = useSesion();
  // se vuelve a pedir cuando cambian las cuotas (después de subir un comprobante o anular un pago)
  const { datos: pagos } = useCarga(() => datos.pagos({ contrato_id: contrato.id }), [datos, contrato.id, cuotas]);
  const { datos: cuentas } = useCarga(() => datos.cuentas(), [datos]);
  const [elegidas, setElegidas] = useState<Set<number>>(() => new Set());
  const [abierto, setAbierto] = useState(false);
  const [viendo, setViendo] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const reparto = useMemo(() => pagosPorCuota(cuotas, pagos ?? [], contrato.cuotas_pagadas_inicial), [cuotas, pagos, contrato.cuotas_pagadas_inicial]);
  const conVoucher = useMemo(() => new Set([...reparto].filter(([, a]) => a.length > 0).map(([n]) => n)), [reparto]);
  const elegibles = useMemo(
    () => (esAdmin ? new Set(cuotas.filter((c) => sinComprobante(c, contrato)).map((c) => c.numero)) : new Set<number>()),
    [cuotas, contrato, esAdmin],
  );
  const lista = cuotas.filter((c) => elegidas.has(c.numero));
  const total = lista.reduce((t, c) => t + c.monto, 0);

  const tocar = (n: number) =>
    setElegidas((s) => {
      const x = new Set(s);
      if (x.has(n)) x.delete(n);
      else x.add(n);
      return x;
    });

  return (
    <div className="flex flex-col gap-3">
      {aviso && (
        <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
          {aviso}
        </Aviso>
      )}
      {elegibles.size > 0 && (
        <p className="rounded-xl bg-marca-suave px-3 py-2 text-sm font-medium text-tinta">
          <b>{elegibles.size} cuotas</b> figuran pagadas en el cuaderno pero no tienen comprobante. Tócalas para elegirlas (varias si se pagaron con un mismo
          voucher) y sube su comprobante: así se ven en el historial de pagos.
        </p>
      )}
      <Cronograma cuotas={cuotas} seleccion={{ elegibles, elegidas, alTocar: tocar, conVoucher, alVer: setViendo }} />
      {lista.length > 0 && (
        <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-marca bg-superficie p-3 shadow-lg md:bottom-4">
          <p className="font-semibold">
            {lista.length === 1 ? "1 cuota" : `${lista.length} cuotas`} · <span className="num">{formatoSoles(total)}</span>
          </p>
          <div className="flex gap-2">
            <Boton variante="secundario" tamano="chico" onClick={() => setElegidas(new Set())}>
              Quitar selección
            </Boton>
            <Boton tamano="chico" onClick={() => setAbierto(true)}>
              Subir comprobante
            </Boton>
          </div>
        </div>
      )}
      <ModalComprobanteAnterior
        abierto={abierto}
        contrato={contrato}
        cuotas={lista}
        cuentas={cuentas ?? []}
        alCerrar={() => setAbierto(false)}
        alGuardar={() => {
          setAviso(`Comprobante guardado: ${lista.map((c) => `N.º ${c.numero}`).join(", ")} ya se ven en el historial de pagos.`);
          setAbierto(false);
          setElegidas(new Set());
          alGuardar();
        }}
      />
      <ModalVoucher numero={viendo} aportes={viendo === null ? [] : (reparto.get(viendo) ?? [])} cuentas={cuentas ?? []} alCerrar={() => setViendo(null)} />
    </div>
  );
}

/** Los pagos que cubren una cuota, con su voucher, medio, cuenta y quién lo registró. */
function ModalVoucher({ numero, aportes, cuentas, alCerrar }: { numero: number | null; aportes: { pago: Pago; monto: number }[]; cuentas: Cuenta[]; alCerrar: () => void }) {
  const nombreCuenta = (id: string | null) => cuentas.find((c) => c.id === id)?.nombre;
  return (
    <Modal abierto={numero !== null} titulo={`Voucher de la cuota N.º ${numero ?? ""}`} alCerrar={alCerrar}>
      <ul className="flex flex-col gap-4">
        {aportes.map(({ pago: p, monto }) => (
          <li key={p.id} className="flex flex-col gap-3 sm:flex-row">
            <Foto bucket="evidencias" ruta={p.foto_ruta} titulo={`Comprobante ${formatoFecha(p.fecha_pago)}`} className="aspect-[3/4] w-full shrink-0 sm:w-44" />
            <div className="flex flex-col gap-1 text-sm">
              <p className="num text-xl font-extrabold">{formatoSoles(p.monto)}</p>
              {monto !== p.monto && <p className="text-tenue">De este pago, {formatoSoles(monto)} fueron para esta cuota.</p>}
              <p>
                <b>Pagó:</b> {formatoFecha(p.fecha_pago)}
              </p>
              <p>
                <b>Medio:</b> {textoMedio(NOMBRE_MEDIO[p.medio], p.entidad_origen)}
                {nombreCuenta(p.cuenta_id) ? ` · ${nombreCuenta(p.cuenta_id)}` : ""}
              </p>
              {p.nro_operacion && (
                <p>
                  <b>N.º de operación:</b> <span className="num">{p.nro_operacion}</span>
                </p>
              )}
              {p.cuotas_anteriores?.length ? <p className="font-semibold text-marca">Comprobante de pago anterior (cuaderno)</p> : null}
              <p className="text-tenue">
                Registró: {p.registrado_por_nombre || "—"} · {formatoFechaHora(p.creado_en)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-tenue">Toca la foto para verla en grande.</p>
    </Modal>
  );
}

interface PropsModal {
  abierto: boolean;
  contrato: Contrato;
  cuotas: Cuota[];
  cuentas: Cuenta[];
  alCerrar: () => void;
  alGuardar: () => void;
}

function ModalComprobanteAnterior({ abierto, contrato, cuotas, cuentas, alCerrar, alGuardar }: PropsModal) {
  const { datos, empresas } = useSesion();
  const [fecha, setFecha] = useState("");
  const [medio, setMedio] = useState<MedioPago>("yape");
  const [cuentaId, setCuentaId] = useState("");
  const [nroOp, setNroOp] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);

  const efectivo = medio === "efectivo";
  const total = cuotas.reduce((t, c) => t + c.monto, 0);
  const nombreEmpresa = useMemo(() => new Map(empresas.map((e) => [e.id, e.nombre])), [empresas]);
  // primero las cuentas de la empresa del contrato; un depósito en agente llega a una cuenta de banco
  const opcionesCuenta = opcionesDeCuenta(
    cuentas.filter((c) => c.medio === medio || (medio === "agente" && c.medio === "banco")),
    contrato.empresa_id,
    nombreEmpresa,
  );

  const guardar = async () => {
    if (enviando.current) return;
    const e: Record<string, string> = {};
    if (!fecha) e.fecha = "Elige la fecha en que pagó.";
    else if (fecha > hoyLima()) e.fecha = "La fecha no puede ser futura.";
    if (!efectivo && !cuentaId) e.cuenta = "Elige la cuenta donde llegó el dinero.";
    if (!efectivo && !nroOp.trim()) e.nro = "Escribe el número de operación.";
    if (!foto) e.foto = "Sube la foto del voucher o del recibo.";
    setErrores(e);
    if (Object.keys(e).length || !foto) return;

    enviando.current = true;
    setGuardando(true);
    setError(null);
    let ruta: string | null = null;
    try {
      const subida = await prepararFotoPago(datos, contrato.empresa_id, contrato.cliente_id, foto);
      ruta = subida.ruta;
      await datos.registrarPagoAnterior({
        contrato_id: contrato.id,
        cuotas: cuotas.map((c) => c.numero),
        fecha_pago: fecha,
        medio,
        cuenta_id: efectivo ? null : cuentaId,
        nro_operacion: efectivo ? null : nroOp.trim(),
        foto_ruta: subida.ruta,
        foto_hash: subida.hash,
      });
      setFoto(null);
      setNroOp("");
      setFecha("");
      alGuardar();
    } catch (err) {
      if (ruta) await borrarFoto(datos, "evidencias", ruta); // si la base rechaza, la foto no se queda
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
      enviando.current = false;
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Comprobante de cuotas del cuaderno"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton cargando={guardando} onClick={guardar}>
            Guardar comprobante
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>
          Cuotas {cuotas.map((c) => `N.º ${c.numero} (${formatoFecha(c.fecha_vencimiento)})`).join(", ")} · total <b className="num">{formatoSoles(total)}</b>. La
          deuda no cambia: solo se guarda cómo y cuándo se pagaron.
        </p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <OpcionesBoton etiqueta="Medio de pago" opciones={OPCIONES_MEDIO} valor={medio} alCambiar={(v) => setMedio(v as MedioPago)} obligatorio />
        <div className="grid gap-4 sm:grid-cols-2">
          {!efectivo && (
            <>
              <Selector
                etiqueta="Cuenta destino"
                opciones={opcionesCuenta}
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                error={errores.cuenta}
                obligatorio
                vacio="Elige…"
              />
              <Campo
                etiqueta="N.º de operación"
                inputMode="numeric"
                value={nroOp}
                onChange={(e) => setNroOp(e.target.value.trim())}
                error={errores.nro}
                obligatorio
                className="num font-semibold"
                autoComplete="off"
              />
            </>
          )}
          <Campo etiqueta="Fecha en que pagó" type="date" max={hoyLima()} value={fecha} onChange={(e) => setFecha(e.target.value)} error={errores.fecha} obligatorio />
        </div>
        <FotoVoucher foto={foto} efectivo={efectivo} error={errores.foto} alCambiar={setFoto} />
      </div>
    </Modal>
  );
}

export function FotoVoucher({ foto, efectivo, error, alCambiar }: { foto: File | null; efectivo: boolean; error?: string; alCambiar: (f: File | null) => void }) {
  if (foto)
    return (
      <div className="flex flex-wrap items-end gap-3">
        <VistaPrevia archivo={foto} alt="Comprobante" className="max-h-56 rounded-xl border border-borde" />
        <Boton variante="secundario" tamano="chico" onClick={() => alCambiar(null)}>
          Cambiar foto
        </Boton>
        {error && <p className="w-full text-sm font-semibold text-rojo">{error}</p>}
      </div>
    );
  return (
    <div>
      <label
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-4 text-center font-semibold hover:bg-marca-suave ${
          error ? "border-rojo text-rojo" : "border-marca text-marca"
        }`}
      >
        <span className="text-3xl" aria-hidden>
          📷
        </span>
        {efectivo ? "Foto del recibo o de la hoja del cuaderno" : "Captura del Yape / Plin o foto del voucher"}
        <input type="file" accept="image/*" className="sr-only" aria-label="Foto del comprobante" onChange={(e) => alCambiar(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="mt-1 text-sm font-semibold text-rojo">{error}</p>}
    </div>
  );
}
