"use client";
import { useState } from "react";
import { useSesion } from "@/components/layout/Sesion";
import { AreaTexto, Aviso, Boton, Modal, NOMBRE_MEDIO, formatoFecha, formatoFechaHora, formatoSoles, mensajeDeError } from "@/components/ui";
import type { Cuenta, Pago } from "@/types/database";
import { Foto } from "../../clientes/_componentes/Foto";

interface Props {
  pagos: Pago[];
  cuentas: Cuenta[];
  /** contrato_id → texto (cliente · placa), para la lista general */
  etiquetas?: Map<string, string>;
  alCambiar: () => void;
}

export function HistorialPagos({ pagos, cuentas, etiquetas, alCambiar }: Props) {
  const { datos, esAdmin } = useSesion();
  const [anulando, setAnulando] = useState<Pago | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cuenta = (id: string | null) => cuentas.find((c) => c.id === id)?.nombre;

  const confirmarAnulacion = async () => {
    if (!anulando) return;
    if (motivo.trim().length < 5) {
      setError("Escribe el motivo (mínimo 5 letras).");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await datos.anularPago(anulando.id, motivo.trim());
      setAviso(`Pago de ${formatoSoles(anulando.monto)} anulado.`);
      setAnulando(null);
      setMotivo("");
      alCambiar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  if (pagos.length === 0) return <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-tenue">Todavía no hay pagos.</p>;

  return (
    <>
      {aviso && (
        <div className="mb-3">
          <Aviso tipo="exito" alCerrar={() => setAviso(null)}>
            {aviso}
          </Aviso>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {pagos.map((p) => (
          <li key={p.id} className={`flex gap-3 rounded-2xl border border-borde p-3 ${p.anulado ? "bg-fondo opacity-70" : "bg-superficie"}`}>
            <Foto bucket="evidencias" ruta={p.foto_ruta} titulo={`Comprobante ${formatoFecha(p.fecha_pago)}`} className="size-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={`num text-lg font-extrabold ${p.anulado ? "line-through" : ""}`}>{formatoSoles(p.monto)}</p>
                <p className="font-semibold">{formatoFecha(p.fecha_pago)}</p>
              </div>
              {etiquetas && <p className="truncate font-semibold">{etiquetas.get(p.contrato_id) ?? "—"}</p>}
              <p className="text-sm text-tenue">
                {NOMBRE_MEDIO[p.medio]}
                {cuenta(p.cuenta_id) ? ` · ${cuenta(p.cuenta_id)}` : ""}
                {p.nro_operacion ? ` · Op. ${p.nro_operacion}` : ""}
              </p>
              <p className="text-sm text-tenue">
                Registró: {p.registrado_por_nombre || "—"} · {formatoFechaHora(p.creado_en)}
              </p>
              {p.anulado && (
                <p className="mt-1 text-sm font-semibold text-rojo">
                  ANULADO{p.motivo_anulacion ? ` — ${p.motivo_anulacion}` : ""}
                </p>
              )}
            </div>
            {esAdmin && !p.anulado && (
              <Boton variante="fantasma" tamano="chico" className="self-start text-rojo" onClick={() => setAnulando(p)}>
                Anular
              </Boton>
            )}
          </li>
        ))}
      </ul>

      <Modal
        abierto={anulando !== null}
        titulo="Anular pago"
        alCerrar={() => {
          setAnulando(null);
          setError(null);
        }}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setAnulando(null)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" cargando={enviando} onClick={confirmarAnulacion}>
              Sí, anular
            </Boton>
          </>
        }
      >
        {anulando && (
          <div className="flex flex-col gap-4">
            <p>
              Vas a anular el pago de <b>{formatoSoles(anulando.monto)}</b> del {formatoFecha(anulando.fecha_pago)}. Las cuotas que cubría vuelven a quedar
              pendientes.
            </p>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <AreaTexto etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} obligatorio placeholder="Ej.: se registró en el cliente equivocado" autoFocus />
          </div>
        )}
      </Modal>
    </>
  );
}
