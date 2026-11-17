"use client";
import { useMemo, useRef, useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { Aviso, Boton, Campo, Modal, OpcionesBoton, Selector, formatoFecha, formatoSoles, hoyLima, mensajeDeError, useCarga } from "@/components/ui";
import { borrarFoto, prepararFotoPago } from "@/lib/fotos";
import { calcularCancelacion } from "@/lib/cancelacion";
import type { Contrato, Cuota, MedioPago } from "@/types/database";
import { mesesDelPlazo } from "../../clientes/_componentes/venta";
import { FotoVoucher, OPCIONES_MEDIO } from "./ComprobanteAnterior";

interface Props {
  abierto: boolean;
  contrato: Contrato;
  cuotas: Cuota[];
  alCerrar: () => void;
  alTerminar: () => void;
}

/**
 * Cancelación anticipada: el cliente paga todo de una vez antes del plazo.
 * Se le cobra el interés (y el GPS) solo de los meses que usó; el monto se calcula y se puede corregir.
 * Se registra como un pago con su voucher y el resto se descuenta: el contrato queda terminado.
 */
export function ModalCancelarTotal({ abierto, contrato, cuotas, alCerrar, alTerminar }: Props) {
  const { datos, empresas } = useSesion();
  const { datos: cuentas } = useCarga(() => datos.cuentas(), [datos]);
  const [fecha, setFecha] = useState(hoyLima());
  const [montoEditado, setMontoEditado] = useState<string | null>(null);
  const [medio, setMedio] = useState<MedioPago>("yape");
  const [cuentaId, setCuentaId] = useState("");
  const [nroOp, setNroOp] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);

  const calculo = useMemo(
    () => calcularCancelacion(contrato, cuotas, fecha || hoyLima(), mesesDelPlazo(contrato.nro_cuotas, contrato.frecuencia ?? "semanal")),
    [contrato, cuotas, fecha],
  );
  const saldo = Math.round(cuotas.reduce((s, c) => s + c.monto - c.monto_pagado, 0) * 100) / 100;
  // sin capital registrado no hay con qué calcular el interés usado: se pone a mano
  const monto = montoEditado ?? (calculo ? calculo.sugerido.toFixed(2) : "");
  const efectivo = medio === "efectivo";
  const nombreEmpresa = useMemo(() => new Map(empresas.map((e) => [e.id, e.nombre])), [empresas]);
  const opcionesCuenta = (cuentas ?? [])
    .filter((c) => c.activa && (c.medio === medio || (medio === "agente" && c.medio === "banco")))
    .sort((a, b) => Number(b.empresa_id === contrato.empresa_id) - Number(a.empresa_id === contrato.empresa_id))
    .map((c) => ({ valor: c.id, texto: c.empresa_id === contrato.empresa_id ? c.nombre : `${c.nombre} (${nombreEmpresa.get(c.empresa_id) ?? ""})` }));

  const guardar = async () => {
    if (enviando.current) return;
    const n = Number(monto);
    const e: Record<string, string> = {};
    if (!fecha) e.fecha = "Elige la fecha.";
    else if (fecha > hoyLima()) e.fecha = "La fecha no puede ser futura.";
    if (!(n > 0)) e.monto = "Escribe el monto que paga para cancelar.";
    else if (n > saldo) e.monto = `No puede ser más de lo que debe (${formatoSoles(saldo)}).`;
    if (!efectivo && !cuentaId) e.cuenta = "Elige la cuenta donde llegó el dinero.";
    if (!efectivo && !nroOp.trim()) e.nro = "Escribe el número de operación.";
    if (!foto) e.foto = "Sube la foto del voucher o del recibo.";
    setErrores(e);
    if (Object.keys(e).length || !foto) return;
    if (!confirm(`¿Cancelar el contrato con ${formatoSoles(n)}? Se descuentan ${formatoSoles(saldo - n)} y el contrato queda terminado.`)) return;

    enviando.current = true;
    setGuardando(true);
    setError(null);
    let ruta: string | null = null;
    try {
      const subida = await prepararFotoPago(datos, contrato.empresa_id, contrato.cliente_id, foto);
      ruta = subida.ruta;
      await datos.cancelarAnticipado({
        contrato_id: contrato.id,
        monto: Math.round(n * 100) / 100,
        fecha_pago: fecha,
        medio,
        cuenta_id: efectivo ? null : cuentaId,
        nro_operacion: efectivo ? null : nroOp.trim(),
        foto_ruta: subida.ruta,
        foto_hash: subida.hash,
      });
      alTerminar();
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
      titulo="Cancelar todo (cancelación anticipada)"
      alCerrar={alCerrar}
      ancho="grande"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Volver
          </Boton>
          <Boton cargando={guardando} onClick={guardar}>
            Registrar y terminar el contrato
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo
          etiqueta="Fecha en que cancela"
          type="date"
          max={hoyLima()}
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            setMontoEditado(null);
          }}
          error={errores.fecha}
          obligatorio
        />
        {calculo ? (
          <dl className="grid gap-x-6 gap-y-1 rounded-xl bg-fondo p-3 text-sm sm:grid-cols-2">
            <Fila t={`Meses usados (desde el ${formatoFecha(calculo.desde)}; el mes en curso cuenta completo)`} v={`${calculo.mesesUsados} de ${Math.ceil(calculo.mesesPlazo)}`} />
            <Fila t="Capital" v={formatoSoles(contrato.capital ?? 0)} />
            <Fila t="Interés de esos meses" v={formatoSoles(calculo.interesUsado)} />
            {calculo.gpsUsado > 0 && <Fila t="GPS de esos meses" v={formatoSoles(calculo.gpsUsado)} />}
            <Fila t="Total por lo usado" v={formatoSoles(calculo.totalUsado)} fuerte />
            <Fila t="Ya pagó" v={`− ${formatoSoles(calculo.pagado)}`} />
            <Fila t="Debía según el cronograma" v={formatoSoles(calculo.saldo)} />
            <Fila t="Se le descuenta" v={formatoSoles(calculo.ahorro)} fuerte />
          </dl>
        ) : (
          <Aviso tipo="alerta">
            Este contrato no tiene capital e interés registrados: escribe a mano cuánto paga para cancelar. Debe {formatoSoles(saldo)} según el cronograma.
          </Aviso>
        )}
        <Campo
          etiqueta="Monto que paga para cancelar (S/)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={monto}
          onChange={(e) => setMontoEditado(e.target.value)}
          error={errores.monto}
          ayuda={calculo ? "Calculado; se puede corregir." : undefined}
          obligatorio
          className="num text-xl font-bold"
        />
        <OpcionesBoton etiqueta="Medio de pago" opciones={OPCIONES_MEDIO} valor={medio} alCambiar={(v) => setMedio(v as MedioPago)} obligatorio />
        {!efectivo && (
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        )}
        <FotoVoucher foto={foto} efectivo={efectivo} error={errores.foto} alCambiar={setFoto} />
        <p className="text-sm text-tenue">
          Se registra como un pago con su voucher; lo que faltaba se descuenta y el contrato queda terminado. Si te equivocas, anula ese pago en el historial y
          todo vuelve como estaba.
        </p>
      </div>
    </Modal>
  );
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-borde/60 py-1 sm:col-span-2">
      <dt className="text-tenue">{t}</dt>
      <dd className={`num ${fuerte ? "font-bold" : "font-semibold"}`}>{v}</dd>
    </div>
  );
}
